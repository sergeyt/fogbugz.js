// http://help.fogcreek.com/8202/xml-api
var http = require('request'),
    xml2js = require('xml2js'),
    Q = require('q');

function identity(x) { return x; }

function format(f) {
	var args = [].slice(arguments, 1);
	return f.replace(/{(\d+)}/g, function(match, i) {
		return typeof args[i] != 'undefined' ? args[i] : "";
	});
}

function get() {
	var url = format.apply([].slice(arguments));
	var d = Q.deffer();
	http.get(url, function(err, res, body) {
		if (err) {
			d.reject(err);
		} else {
			xml2js.parseString(body, function(error, result) {
				if (error) {
					d.reject(error);
				} else {
					d.resolve(result);
				}
			});
		}
	});
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
			return d;
		}
		
		function convertAreas(d) {
			return d;
		}
		
		function convertProjects(d) {
			return d;
		}
		
		return {
			logout: function() { return simpleCmd("logoff"); },
			
			// lists
			filters: list("Filters", convertFilters),
			projects: list("Projects", convertProjects),
			areas: list("Areas", convertAreas),
			categories: list("Categories"),
			priorities: list("Priorities"),
			milestones: list("FixFors"),
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
		return client(d.response.token);
	});
};

