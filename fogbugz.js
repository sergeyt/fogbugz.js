// based on http://help.fogcreek.com/8202/xml-api
(function(){

	var extend, defer, promise, request, xml2js;
	var env = 'browser';
	if (typeof module !== 'undefined') {
		env = 'node';
	} else if (typeof Meteor !== 'undefined' && Meteor.isServer) {
		env = 'meteor';
	}

	switch (env){
		case 'node': {
			request = require('request');
			xml2js = require('xml2js');
			var Q = require('q');
			extend = require('underscore').extend;
			defer = Q.defer;
			promise = Q;
		}
		break;
		case 'meteor': {
			request = Npm.require('request');
			xml2js = Npm.require('xml2js');
			var q = Npm.require('q');
			extend = _.extend;
			defer = q.defer;
			promise = q;
		}
		break;
		default: {
			extend = $.extend;
			defer = $.Deferred;
			promise = function(value){
				return $.Deferred().resolve(value).promise();
			};
			// TODO ensure that body is string not document object
			request = function(url, callback){
				$.get(url).done(function(body, status, xhr){
					callback(null, xhr.response, body);
				}).fail(function(err){
					callback(err, null, null);
				});
			};
			// TODO xml2js
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

	function getUrl(url) {
		log && console.log("GET %s", url);

		var def = defer();

		request(url, function(err, res, body) {
			if (err) {
				def.reject(err);
			} else {
				log && console.log(body);
				def.resolve(body);
			}
		});

		return def.promise;
	}

	function parseXml(xml) {
		var def = defer();
		xml2js.parseString(xml, function(error, obj) {
			if (error) {
				def.reject(error);
			} else if (!obj.response) {
				def.reject("unexpected response!");
			} else if (obj.response.error) {
				def.reject(obj.response.error[0]._);
			} else {
				def.resolve(obj.response);
			}
		});
		return def.promise;
	}

	function get() {
		var url = format.apply(null, [].slice.call(arguments));
		return getUrl(url).then(parseXml);
	}

	// converters from FogBugz XMLJS payloads to plain JS objects

	var convert = (function(){

		// resolves xmljs array
		function getarr(d) {
			var arr = [d];
			for (var i = 1; i < arguments.length; i++) {
				var p = arguments[i];
				var v = arr[0][p];
				if (v === null || v === undefined) {
					return [];
				}
				arr = Array.isArray(v) ? v : [v];
				if (arr.length === 0) {
					return [];
				}
			}
			return arr;
		}

		function bool(x) {
			return typeof x === "string" ? x.toLowerCase() === 'true' : !!x;
		}

		function parse(key, val) {
			// unwrap array
			var v = Array.isArray(val) ? val[0] : val;
			if (/^f.+$/.test(key)) {
				return bool(v);
			} else if (/^ix.+$/.test(key)) {
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

		var person = use({
			id: 'ixPerson',
			name: 'sFullName',
			email: 'sEmail',
			admin: 'fAdministrator',
			community: 'fCommunity',
			virtual: 'fVirtual',
			deleted: 'fDeleted',
			notify: 'fNotify',
			homepage: 'sHomepage',
			locale: 'sLocale',
			language: 'sLanguage',
			workingOn: 'ixBugWorkingOn'
		});

		var event = use({
			id: 'ixBugEvent',
			date: 'dt',
			verb: 'sVerb',
			description: 'evtDescription',
			person: {
				id: 'ixPerson',
				name: 'sPerson'
			},
			assignee: 'ixPersonAssignedTo',
			format: 'sFormat',
			text: 's',
			changes: 'sChanges',
			html: 'sHtml',
			message: {
				from: 'sFrom',
				to: 'sTo',
				cc: 'sCC',
				bcc: 'sBCC',
				replyTo: 'sReplyTo',
				subject: 'sSubject',
				date: 'sDate',
				bodyText: 'sBodyText',
				bodyHTML: 'sBodyHTML'
			}
		});

		return {
			filters: function(d) {
				return getarr(d, 'filters', 'filter').map(function(it) {
					return {
						name: it._,
						type: it.$.type
					};
				});
			},

			projects: function(d) {
				return getarr(d, 'projects', 'project').map(use({
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
				return getarr(d, 'areas', 'area').map(use({
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
				return getarr(d, 'categories', 'category').map(use({
					id: 'ixCategory',
					name: 'sCategory',
					plural: 'sPlural',
					defaultStatus: {
						resolve: 'ixStatusDefault',
						open: 'ixStatusDefaultActive'
					}
				}));
			},

			priorities: function(d) {
				return getarr(d, 'priorities', 'priority').map(use({
					id: 'ixPriority',
					name: 'sPriority',
					isDefault: 'fDefault'
				}));
			},

			statuses: function(d) {
				return getarr(d, 'statuses', 'status').map(use({
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
				return getarr(d, 'fixfors', 'fixfor').map(use({
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
				return getarr(d, 'person').map(person)[0];
			},
			people: function(d) {
				return getarr(d, 'people', 'person').map(person);
			},

			searchCols: [
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
				'events',
				// dates
				'dtOpened',
				'dtResolved',
				'dtClosed',
				'dtDue',
				'dtFixFor'
			].join(','),

			cases: function(d) {
				return getarr(d, 'cases', 'case').map(use({
					id: 'ixBug',
					status: {
						id: 'ixStatus',
						name: 'sStatus'
					},
					operations: '$.operations',
					opened: 'dtOpened',
					resolved: 'dtResolved',
					closed: 'dtClosed',
					due: 'dtDue',
					assignee: {
						id: 'ixPersonAssignedTo',
						name: 'sPersonAssignedTo',
						email: 'sEmailAssignedTo'
					},
					openedBy: {
						id: 'ixPersonOpenedBy'
					},
					resolvedBy: {
						id: 'ixPersonResolvedBy'
					},
					parentId: 'ixBugParent',
					children: 'ixBugChildren',
					title: 'sTitle',
					priority: {
						id: 'ixPriority',
						name: 'sPriority'
					},
					category: {
						id: 'ixCategory',
						name: 'sCategory'
					},
					milestone: {
						id: 'ixFixFor',
						name: 'sFixFor',
						end: 'dtFixFor'
					},
					version: 'sVersion',
					computer: 'sComputer',
					ticket: 'sTicket',
					latestSummary: 'sLatestTextSummary',
					isOpen: 'fOpen',
					tags: 'tags.tag[]',
					events: function(it) {
						return getarr(it, 'events', 'event').map(event);
					}
				}));
			},

			events: function(d) {
				return getarr(d, 'cases', 'case', 'events', 'event').map(event);
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
						if (it.project && it.project.name){
							q += 'project:"' + it.project.name + '" AND ';
						}
						q += 'fixfor:"' + it.name + '"';
						return fb.search(q);
					}
				});
			};
		}
	};

	// TODO verify api token
	// creates new client with specified options
	function fogbugz(options) {

		if (!options) {
			throw new Error("Options are not specified.");
		}
		if (!options.url || typeof options.url !== "string") {
			throw new Error("Required url option is not specified.");
		}

		// use only for dev purposes!
		if (!!options.verbose){
			log = true;
		}

		// TODO if DEBUG only for testing purposes
		// allow to replace request module for testing purposes
		if (options.request){
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

			function map(fn) {
				return function(arr) {
					return arr.map(fn);
				};
			}

			function simpleCmd(name) {
				return get("{0}cmd={1}", clientUrl, name);
			}

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

			function search(q, max) {
				return cmd("search", "q", q, "max", max, "cols", convert.searchCols).then(convert.cases);
			}

			function caseInfo(id){
				return search("ixBug:" + id).then(function(list){
					return list.length === 0 ? null : list[0];
				});
			}

			function events(id) {
				return cmd("search", "q", "ixBug:" + id, "cols", "events").then(convert.events);
			}

			function caseCmd(cmdname, data) {
				var userArg = isNaN(parseInt(data.user, 10)) ? "sPersonAssignedTo" : "ixPersonAssignedTo";
				var statusArg = isNaN(parseInt(data.status, 10)) ? "sStatus" : "ixStatus";
				return cmd(cmdname,
						"ixBug", data.id,
						"sTitle", data.title,
						"sProject", data.project,  // TODO id or name
						"sArea", data.area,  // TODO id or name
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

			function create(info) {
				return caseCmd("new", info);
			}

			function edit(info) {
				return caseCmd("edit", info);
			}

			// logs comment to specified case
			function comment(id, text) {
				if (!id) {
					throw new Error("case number is not specified");
				}
				if (!text) {
					throw new Error("comment is not specified");
				}
				return edit({id: id, comment: text});
			}

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

			function take(id, comment) {
				return currentUser().then(function(user) {
					return assign(id, user.id, comment);
				});
			}

			function close(id, comment) {
				return cmd("close", "ixBug", id, "sEvent", comment);
			}

			function reopen(id, comment) {
				return cmd("reopen", "ixBug", id, "sEvent", comment);
			}

			function resolve(data) {
				var userArg = isNaN(parseInt(data.user, 10)) ? "sPersonAssignedTo" : "ixPersonAssignedTo";
				var statusArg = isNaN(parseInt(data.status, 10)) ? "sStatus" : "ixStatus";
				return cmd("resolve",
						"ixBug", data.id,
						statusArg, data.status,
						userArg, data.user,
						"sEvent", data.comment);
			}

			return {
				token: token,
				logout: function() {
					return simpleCmd("logoff");
				},

				// lists
				filters: list("Filters", convert.filters),
				projects: list("Projects", convert.projects),
				people: list("People", convert.people),
				areas: list("Areas", convert.areas),
				categories: list("Categories", convert.categories),
				priorities: list("Priorities", convert.priorities),
				statuses: list("Statuses", convert.statuses),
				milestones: list("FixFors", convert.milestones, map(fn.milestone(fb))),
				// TODO provide converters for below lists
				mailboxes: list("Mailboxes"),
				wikis: list("Wikis"),
				templates: list("Templates"), // wiki templates
				snippets: list("Snippets"),

				// list cases
				search: search,
				events: events,
				caseInfo: caseInfo,

				// editing cases
				open: create,
				"new": create,
				edit: edit,
				assign: assign,
				take: take,
				log: comment,
				resolve: resolve,
				close: close,
				reopen: reopen,

				// helpers
				userInfo: userInfo,

				// extends specified milestone object with cases
				milestone: function(m){
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

	// expose public api
	if (env === 'node') {
		module.exports = fogbugz;
	} else if (env === 'meteor') {
		FogBugz = {};
		FogBugz.connect = fogbugz;
	} else { // browser
		window.fogbugz = fogbugz;
	}

})();