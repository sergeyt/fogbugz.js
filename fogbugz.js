// based on http://help.fogcreek.com/8202/xml-api
(function() {
  var extend, defer, promise, request, xml2js, parallel;
  var env = 'browser';
  if (typeof module !== 'undefined') {
    env = 'node';
  } else if (typeof Meteor !== 'undefined' && Meteor.isServer) {
    env = 'meteor';
  }

  switch (env) {
    case 'node':
      {
        console.log('fogbugz.js: running in node environment');
        var request = require('request');
        var Utils = require('./utils.js');
        var { Person, Case, Event} = require('./models');
        var xml2js = require('xml2js');
        var Q = require('q');
        var extend = require('underscore').extend;
        var defer = Q.defer;
        var promise = Q;
        var parallel = require('async').parallel;
      }
      break;
    case 'meteor':
      {
        console.log('fogbugz.js: running in meteor environment');
        request = Npm.require('request');
        xml2js = Npm.require('xml2js');
        var q = Npm.require('q');
        extend = Npm.require('underscore').extend;
        defer = q.defer;
        promise = q;
        parallel = Npm.require('async').parallel;
      }
      break;
    default:
      {
        console.log('fogbugz.js: running in browser environment');
        extend = $.extend;
        defer = $.Deferred;
        promise = function(value) {
          return $.Deferred().resolve(value).promise();
        };
        // TODO ensure that body is string not document object
        request = function(url, callback) {
          $.get(url).done(function(body, status, xhr) {
            callback(null, xhr.response, body);
          }).fail(function(err) {
            callback(err, null, null);
          });
        };
        // requires jQuery-xml2json to be included before fogbugz.js script
        xml2js = {
          parseString: function(xml, cb) {
            try {
              cb(null, $.xml2json(xml));
            } catch (err) {
              cb(err, null);
            }
          }
        };
        parallel = function(funcs, callback) {
          var count = 0;
          var result = [];
          var error = null;

          function done(err, res) {
            count++;
            result.push(res);
            error = error || err;
            if (count === funcs.length) {
              callback(error, result);
            }
          }

          function run(fn) {
            fn(done);
          }

          funcs.forEach(run);
        };
      }
      break;
  }

  var log = false;

  function format(f) {
    var args = [].slice.call(arguments, 1);
    return f.replace(/\{(\d+)\}/g, function(match, i) {
      return typeof args[i] !== 'undefined' ? args[i] : "";
    });
  }

  function defer_promise(d) {
    return typeof d.promise === 'function' ? d.promise() : d.promise;
  }

  function getUrl(url) {
    log && console.log("GET %s", url);
    var d = defer();

    request(url, function(err, res, body) {
      if (err) {
        log && console.log(err);
        d.reject(err);
      } else {
        log && console.log(body);
        d.resolve(body);
      }
    });

    return defer_promise(d);
  }

  function parseXml(xml) {
    var d = defer();
    xml2js.parseString(xml, function(err, obj) {
      if (err) {
        log && console.log(err);
        d.reject(err);
      } else if (!obj.response) {
        d.reject("unexpected response");
      } else if (obj.response.error) {
        err = obj.response.error;
        if (Array.isArray(err)) {
          err = err[0];
        }
        if (err._) {
          err = err._;
        }
        d.reject(err);
      } else {
        d.resolve(obj.response);
      }
    });
    return defer_promise(d);
  }

  function get() {
    var url = format.apply(null, [].slice.call(arguments));
    return getUrl(url).then(parseXml);
  }

  // converters from FogBugz XMLJS payloads to plain JS objects
  let customFields = [];
  let searchCols = [
    'ixBug',
    'ixStatus',
    'sStatus',
    'ixPersonAssignedTo',
    'sPersonAssignedTo',
    'sEmailAssignedTo',
    'ixPersonOpenedBy',
    'ixPersonResolvedBy',
    'ixBugParent',
    'ixBugChildren',
    'ixBugDuplicates',
    'ixBugOriginal',
    'sTitle',
    'ixPriority',
    'sPriority',
    'ixCategory',
    'sCategory',
    'ixFixFor',
    'sFixFor',
    'sVersion',
    'sComputer',
    'sTicket',
    'sLatestTextSummary',
    'fOpen',
    'tags',
    'ixProject',
    'sProject',
    'ixArea',
    'sArea',
    'fSubscribed',
    'dblStoryPts',
    'sReleaseNotes',
    'dtOpened',
    'dtResolved',
    'dtClosed',
    'dtDue',
    'dtFixFor'
  ];

  var convert = (function() {
    function bool(x) {
      return typeof x === "string" ? x.toLowerCase() === 'true' : !!x;
    }

    function parse(key, val) {
      // unwrap array
      var v = Array.isArray(val) ? val[0] : val;
      if (/^f.+$/.test(key)) {
        return bool(v);
      } else if (/^[in].+$/.test(key)) {
        var i = parseInt(v, 10);
        return isNaN(i) ? v : i;
      } else if (/^dt.*$/.test(key)) {
        // TODO handle invalid dates
        return new Date(v);
      }
      return v;
    }

    function get(obj, key) {
      var v;
      if (/^.+\[]$/.test(key)) {
        v = obj[key.substr(0, key.length - 2)] || [];
      } else {
        v = parse(key, obj[key]);
      }
      return v;
    }

    function mapget(arr, name) {
      return arr.map(function(x) {
        return get(x, name);
      });
    }

    function evalchain(chain, it) {
      for (var i = 0; i < chain.length; i++) {
        var name = chain[i];
        if (Array.isArray(it)) {
          it = mapget(it, name);
        } else {
          it = get(it, name);
        }
        if (it === null || it === undefined) {
          break;
        }
      }
      return it;
    }

    // creates convertion function from given schema
    function use(schema) {
      return function(it) {
        var props = Object.keys(schema).map(function(key) {
          var p = schema[key];
          var v;
          if (typeof p === "string") {
            var chain = p.split('.');
            v = evalchain(chain, it);
            if (v === null || v === undefined) {
              return {};
            }
          } else if (typeof p === 'function') {
            v = p(it);
          } else {
            v = use(p)(it);
          }
          var obj = {};
          obj[key] = v;
          return obj;
        });
        return extend.apply(null, props);
      };
    }

    var person = new Person();;

    return {
      filters: function(d) {
        return Utils.getarr(d, 'filters', 'filter').map(function(it) {
          return {
            id: it.$.sFilter,
            name: it._,
            type: it.$.type,
            status: it.$.status
          };
        });
      },

      projects: function(d) {
        return Utils.getarr(d, 'projects', 'project').map(use({
          id: 'ixProject',
          name: 'sProject',
          owner: {
            id: 'ixPersonOwner',
            name: 'sPersonOwner'
          },
          email: 'sEmail',
          phone: 'sPhone',
          workflowId: 'ixWorkflow',
          deleted: 'fDeleted',
          inbox: 'fInbox',
          type: 'iType',
          group: 'sGroup'
        }));
      },

      areas: function(d) {
        return Utils.getarr(d, 'areas', 'area').map(use({
          id: 'ixArea',
          name: 'sArea',
          project: {
            id: 'ixProject',
            name: 'sProject'
          },
          owner: {
            id: 'ixPersonOwner',
            name: 'sPersonOwner'
          },
          type: 'nType',
          doc: 'cDoc'
        }));
      },

      categories: function(d) {
        return Utils.getarr(d, 'categories', 'category').map(use({
          id: 'ixCategory',
          name: 'sCategory',
          plural: 'sPlural',
          on: {
            resolve: 'ixStatusDefault',
            open: 'ixStatusDefaultActive'
          },
          isScheduleItem: 'fIsScheduleItem'
        }));
      },

      priorities: function(d) {
        return Utils.getarr(d, 'priorities', 'priority').map(use({
          id: 'ixPriority',
          name: 'sPriority',
          isDefault: 'fDefault'
        }));
      },

      statuses: function(d) {
        return Utils.getarr(d, 'statuses', 'status').map(use({
          id: 'ixStatus',
          name: 'sStatus',
          category: 'ixCategory',
          isResolved: 'fResolved',
          isDuplicate: 'fDuplicate',
          isDeleted: 'fDeleted',
          workDone: 'fWorkDone',
          order: 'iOrder'
        }));
      },

      milestones: function(d) {
        return Utils.getarr(d, 'fixfors', 'fixfor').map(use({
          id: 'ixFixFor',
          name: 'sFixFor',
          project: {
            id: 'ixProject',
            name: 'sProject'
          },
          deleted: 'fDeleted',
          start: 'dtStart',
          end: 'dt',
          startNote: 'sStartNote'
        }));
      },

      person: function(d) {
        return Utils.getarr(d, 'person').map(person)[0];
      },
      people: function(d) {
        return Utils.getarr(d, 'people', 'person').map(person);
      },
      cases: function(d) {
        return Utils.getarr(d, 'cases', 'case').map(new Case(customFields));
      },

      events: function(d) {
        return Utils.getarr(d, 'cases', 'case', 'events', 'event').map(new Event());
      }
    };
  })();

  // extend functions for fogbugz objects
  var fn = {
    milestone: function(fb) {
      return function(it) {
        return extend(it, {
          cases: function() {
            var q = "";
            if (it.project && it.project.name) {
              q += 'project:"' + it.project.name + '" AND ';
            }
            q += 'fixfor:"' + it.name + '"';
            return fb.search(q);
          }
        });
      };
    }
  };

  // creates new client with specified options
  function fogbugz(options) {
    if (!options) {
      throw new Error("Options are not specified.");
    }

    if (!options.url || typeof options.url !== "string") {
      throw new Error("Required url option is not specified.");
    }

    if (options.customFields) {
      customFields = customFields.concat(options.customFields);
      searchCols = searchCols.concat(options.customFields);
    }

    // TODO verbose flag per client
    // use only for dev purposes!
    if (!!options.verbose) {
      log = true;
    }

    // TODO if DEBUG only for testing purposes
    // allow to replace request module for testing purposes
    if (options.request) {
      request = options.request;
    }

    // normalize url
    var apiUrl = options.url;
    if (apiUrl.charAt(apiUrl.length - 1) !== '/') {
      apiUrl += '/';
    }
    apiUrl += 'api.asp?';

    function client(token) {

      var clientUrl = format("{0}token={1}&", apiUrl, token);
      var fb;

      // returns function which map array elements with given function
      function map(fn) {
        return function(arr) {
          return arr.map(fn);
        };
      }

      // runs simple command without arguments
      function simpleCmd(name) {
        return get("{0}cmd={1}", clientUrl, name);
      }

      // runs list command
      function list(name) {
        var fns = [].slice.call(arguments, 1);
        return function() {
          var p = simpleCmd("list" + name);
          fns.forEach(function(fn) {
            p = p.then(fn);
          });
          return p;
        };
      }

      // performs given command with specified arguments
      function cmd(name) {
        var url = format("{0}cmd={1}&", clientUrl, name);
        var i = 1;
        while (i + 1 < arguments.length) {
          var arg = arguments[i++];
          var val = arguments[i++];
          if (val) {
            url += "&" + arg;
            url += "=" + encodeURIComponent(String(val));
          }
        }
        return get(url);
      }

      // runs search command
      function search(q, max, withoutEvents) {
        return cmd("search", "q", q, "max", max, "cols", searchCols)
          .then(convert.cases)
          .then(function(list) {
            if (withoutEvents) {
              return list;
            }

            function fetchFn(i) {
              var item = i;
              return function(cb) {
                events(item.id).then(function(eventList) {
                  item.events = eventList;
                  cb(null, item);
                  return item;
                }).fail(function(err) {
                  cb(err, null);
                });
              };
            }

            var d = defer();

            parallel(list.map(fetchFn), function() {
              d.resolve(list);
            });


            return defer_promise(d);
          });
      }

      // fetch case details by given case number
      function caseInfo(id) {
        return search("ixBug:" + id).then(function(list) {
          return list.length === 0 ? null : list[0];
        });
      }

      // fetch events of given case
      function events(id) {
        return cmd("search", "q", "ixBug:" + id, "cols", "events").then(convert.events);
      }

      function caseCmd(cmdname, data) {
        var userArg = isNaN(parseInt(data.user, 10)) ? "sPersonAssignedTo" : "ixPersonAssignedTo";
        var statusArg = isNaN(parseInt(data.status, 10)) ? "sStatus" : "ixStatus";
        return cmd(cmdname,
          "ixBug", data.id,
          "sTitle", data.title,
          "sProject", data.project, // TODO id or name
          "sArea", data.area, // TODO id or name
          "sFixFor", data.milestone, // TODO id or name
          "sCategory", data.category, // TODO map categories
          userArg, data.user,
          statusArg, data.status,
          "sPriority", data.priority, // TODO id or name
          "sTags", data.tags,
          "sCustomerEmail", data.customerEmail,
          "sEvent", data.comment
        );
      }

      // creates new case with given info
      function create(info) {
        return caseCmd("new", info);
      }

      // edits specified case
      function edit(info) {
        return caseCmd("edit", info);
      }

      // adds comment to specified case
      function comment(opts, text, format) {

        var id;

        // allow to pass options as first argument
        if (typeof opts === 'object') {
          id = opts.id;
          text = opts.text || opts.comment || opts.message;
          format = opts.format || '';
        } else {
          id = opts;
          format = format || '';
        }

        // check required options
        if (!id) {
          throw new Error("case number is not specified");
        }
        if (!text) {
          throw new Error("comment is not specified");
        }

        // TODO how to post comment in specified format?

        return edit({ id: id, comment: text, format: format });
      }

      // assigns given case to specified command with optional comment
      function assign(id, user, comment) {
        if (!id) {
          throw new Error("case number is not specified");
        }
        if (!user) {
          throw new Error("user is not specified");
        }
        var userArg = isNaN(parseInt(user, 10)) ? "sPersonAssignedTo" : "ixPersonAssignedTo";
        return cmd("assign", "ixBug", id, userArg, user, "sEvent", comment);
      }

      // internal API for extenders
      fb = {
        search: search,
        events: events
      };

      // fetch user info for given user id/email
      function userInfo(user) {
        if (user || user.id || user.email) {
          if (user.id) {
            return cmd("viewPerson", "ixPerson", user.id).then(convert.person);
          }
          if (user.email) {
            return cmd("viewPerson", "sEmail", user.email).then(convert.person);
          }
          var userArg = isNaN(parseInt(user, 10)) ? "ixPerson" : "sEmail";
          return cmd("viewPerson", userArg, user).then(convert.person);
        }
        return simpleCmd("viewPerson").then(convert.person);
      }

      // resolves info about currently logon user
      function currentUser() {
        return userInfo();
      }

      // assign given case to current user with optional comment
      function take(id, comment) {
        return currentUser().then(function(user) {
          return assign(id, user.id, comment);
        });
      }

      // closes given case with optional comment
      function close(id, comment) {
        return cmd("close", "ixBug", id, "sEvent", comment);
      }

      // reopens given case with optional comment
      function reopen(id, comment) {
        return cmd("reopen", "ixBug", id, "sEvent", comment);
      }

      // resolves specified case
      function resolve(data) {
        var userArg = isNaN(parseInt(data.user, 10)) ? "sPersonAssignedTo" : "ixPersonAssignedTo";
        var statusArg = isNaN(parseInt(data.status, 10)) ? "sStatus" : "ixStatus";
        return cmd("resolve",
          "ixBug", data.id,
          statusArg, data.status,
          userArg, data.user,
          "sEvent", data.comment);
      }

      // fetch user settings
      function userSettings() {
        return simpleCmd('viewSettings');
      }

      // start working on this case and charge time to it (start the stopwatch)
      function startWork(id) {
        return cmd("startWork", "ixBug", id);
      }

      // stop working on everything (stop the stopwatch)
      function stopWork() {
        return simpleCmd("stopWork");
      }

      function starImpl(cmdname, id, type) {
        type = type || 'bug';
        switch (type.toLowerCase()) {
          case 'bug':
            type = 'Bug';
            break;
          case 'case':
            type = 'Bug';
            break;
          case 'wikipage':
            type = 'WikiPage';
            break;
          case 'wiki':
            type = 'WikiPage';
            break;
          case 'discusstopic':
            type = 'DiscussTopic';
            break;
          case 'discuss':
            type = 'DiscussTopic';
            break;
          case 'topic':
            type = 'DiscussTopic';
            break;
        }
        return cmd(cmdname, "sType", type, "ixItem", id);
      }

      function star(id, type) {
        return starImpl('star', id, type);
      }

      function unstar(id, type) {
        return starImpl('unstar', id, type);
      }

      return {
        token: token,

        // runs logoff command
        logout: function() {
          return simpleCmd("logoff");
        },

        // fetch list of filters
        filters: list("Filters", convert.filters),

        // fetch list of projects
        projects: list("Projects", convert.projects),

        // fetch list of users
        people: list("People", convert.people),
        users: list("People", convert.people),

        // fetch list of areas
        areas: list("Areas", convert.areas),

        // fetch list of available case categories
        categories: list("Categories", convert.categories),

        // fetch list of available case priorities
        priorities: list("Priorities", convert.priorities),

        // fetch list of available case statuses
        statuses: list("Statuses", convert.statuses),

        // fetch list of milestones
        milestones: function(plain) {
          var p = list("FixFors", convert.milestones)();
          if (!!plain) {
            return p;
          }
          return p.then(map(fn.milestone(fb)));
        },

        // TODO provide converters for lists below
        mailboxes: list("Mailboxes"),
        wikis: list("Wikis"),
        templates: list("Templates"), // wiki templates
        snippets: list("Snippets"),

        // performs search with given options
        search: search,

        // fetch events of given case number
        events: events,

        // fetch case details by given case number
        caseInfo: caseInfo,

        // editing cases

        // creates new case with given info
        open: create,
        "new": create,
        create: create,

        // edits specfied case updating fields from info
        edit: edit,

        // assigns given case to specified command with optional comment
        assign: assign,

        // assign given case to current user with optional comment
        take: take,

        // adds comment to given case
        log: comment,
        comment: comment,

        // resolves specified case
        resolve: resolve,

        // closes given case with optional comment
        close: close,

        // reopens given case with optional comment
        reopen: reopen,

        // start working on this case and charge time to it (start the stopwatch)
        start: startWork,
        startWork: startWork,

        // stop working on everything (stop the stopwatch)
        stop: stopWork,
        stopWork: stopWork,

        star: star,
        unstar: unstar,

        // fetch user info
        userInfo: userInfo,

        // fetch user settings
        userSettings: userSettings,

        // extends specified milestone object with cases
        milestone: function(m) {
          return fn.milestone(fb)(m);
        }
      };
    }

    // creating client with given token
    if (typeof options.token === "string") {
      if (!options.token) {
        throw new Error("token option is empty.");
      }
      return promise(client(options.token));
    }

    // login then create client
    var user = options.email || options.user;
    var pwd = options.password || options.pwd;

    if (!user || typeof user !== "string") {
      throw new Error("Required email option is not specified.");
    }

    if (!pwd || typeof pwd !== "string") {
      throw new Error("Required password option is not specified.");
    }

    return get("{0}cmd=logon&email={1}&password={2}", apiUrl, user, pwd).then(function(d) {
      return client(Array.isArray(d.token) ? d.token[0] : d.token);
    });
  }

  // expose public api for different environments
  switch (env) {
    case 'node':
      module.exports = fogbugz;
      break;
    case 'meteor':
      FogBugz = fogbugz;
      // aliases
      FogBugz.connect = fogbugz;
      FogBugz.create = fogbugz;
      break;
    default:
      window.fogbugz = fogbugz;
      break;
  }

})();