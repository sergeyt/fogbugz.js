// http://help.fogcreek.com/8202/xml-api
var http = require('request'),
    xml2js = require('xml2js'),
    Q = require('q');

var log = false;

function identity(x) { return x; }
function bool(s) { return s && s.toLowerCase() == 'true'; }

function format(f) {
	var args = [].slice.call(arguments, 1);
	return f.replace(/{(\d+)}/g, function(match, i) {
		return typeof args[i] != 'undefined' ? args[i] : "";
	});
}

function get() {
	var url = format.apply(null, [].slice.call(arguments));
	log && console.log("GET %s", url);
	
	var def = Q.defer();
	
	http.get(url, function(err, res, body) {
		if (err) {
			def.reject(err);
		} else {
			log && console.log(body);
			xml2js.parseString(body, function(error, d) {
				if (error) {
					def.reject(error);
				} else if (!d.response) {
					def.reject("unexpected response!");
				} else if (d.response.error) {
					def.reject(d.response.error[0]._);
				} else {
					def.resolve(d.response);
				}
			});
		}
	});

	return def.promise;
}

// creates new client with specified options
module.exports = function(options) {

	if (!options) {
		throw new Error("Options are not specified.");
	}
	if (!options.url || typeof options.url != "string") {
		throw new Error("Required url option is not specified.");
	}
	if (!options.email || typeof options.email != "string") {
		throw new Error("Required email option is not specified.");
	}
	if (!options.password || typeof options.password != "string") {
		throw new Error("Required password option is not specified.");
	}

	// normalize url
	var apiUrl = options.url;
	if (apiUrl.charAt(apiUrl.length - 1) != '/') {
		apiUrl += '/';
	}
	apiUrl += 'api.asp?';

	function client(token) {

		var clientUrl = format("{0}token={1}&", apiUrl, token);

		function simpleCmd(name) {
			return get("{0}cmd={1}", clientUrl, name);
		}

		function list(name, convert) {
			return function() {
				return simpleCmd("list" + name).then(convert || identity);
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
					url += "=" + val;
				}
			}
			return get(url);
		}
		
		function convertFilters(d) {
			return d.filters[0].filter.map(function(f) {
				return {
					name: f._,
					type: f.$.type,
				};
			});
		}
		
		function convertProjects(d) {
			return d.projects[0].project.map(function(p) {
				return {
					id: p.ixProject[0],
					name: p.sProject[0],
					owner: {
						id: p.ixPersonOwner[0],
						name: p.sPersonOwner[0]
					},
					email: p.sEmail[0],
					phone: p.sPhone[0],
					workflowId: p.ixWorkflow[0],
					deleted: bool(p.fDeleted[0]),
					inbox: bool(p.fInbox[0])
				};
			});
		}
		
		function convertAreas(d) {
			return d;
		}
		
		function convertCategories(d) {
			return d.categories[0].category.map(function(c) {
				return {
					id: c.ixCategory[0],
					name: c.sCategory[0],
					plural: c.sPlural[0]
				};
			});
		}
		
		function convertPriorities(d) {
			return d.priorities[0].priority.map(function(p) {
				return {
					id: p.ixPriority[0],
					name: p.sPriority[0],
					isDefault: bool(p.fDefault[0])
				};
			});
		}

		function convertMilestones(d) {
			return d.fixfors[0].fixfor.map(function(m) {
				return {
					id: m.ixFixFor[0],
					name: m.sFixFor[0],
					deleted: bool(m.fDeleted[0]),
					project: {
						id: m.ixProject[0],
						name: m.sProject[0]
					}
				};
			});
		}

		return {
			logout: function() { return simpleCmd("logoff"); },
			
			// lists
			filters: list("Filters", convertFilters),
			projects: list("Projects", convertProjects),
			areas: list("Areas", convertAreas),
			categories: list("Categories", convertCategories),
			priorities: list("Priorities", convertPriorities),
			milestones: list("FixFors", convertMilestones),
			mailboxes: list("Mailboxes"),
			wikis: list("Wikis"),
			templates: list("Templates"), // wiki templates
			snippets: list("Snippets"),
			
			// list cases
			
			// editing cases
			open: function(info) {
				return cmd("new",
					"sTitle", info.title,
					"sProject", info.project.id,
					"sArea", info.area,
					"sFixFor", info.milestone,
					"sCategory", info.category, // TODO map categories
					"sPersonAssignedTo", info.person,
					"sPriority", info.priority, // TODO map priority
					"sTags", info.tags,
					"sCustomerEmail", info.customerEmail,
					"sEvent", info.event
				);
			}
		};
	}

	return get("{0}cmd=logon&email={1}&password={2}", apiUrl, options.email, options.password).then(function(d) {
		return client(d.token);
	});
};

