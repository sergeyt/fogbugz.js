// converters from FogBugz XMLJS payloads to plain JS objects
var isarray = require('isarray'),
    extend = require('extend');

// resolves xmljs array
function get(d, p1, p2) {
	var arr = d[p1] || [];
	return arr.length == 0 ? [] : arr[0][p2] || [];
}

function bool(x) {
	return typeof x == "string" ? x.toLowerCase() == 'true' : !!x;
}

function parse(key, val) {
	// unwrap array
	val = isarray(val) ? val[0] : val;
	if (/^f.+$/.test(key)) {
		return bool(val);
	} else if (/^ix.+$/.test(key)) {
		var i = parseInt(val, 10);
		return isNaN(i) ? val : i;
	}
	return val;
}

// creates convertion function from given schema
function use(schema) {
	return function(it) {
		var props = Object.keys(schema).map(function(key) {
			var p = schema[key];
			var v;
			if (typeof p == "string") {
				if (p == '_') {
					v = it._;
				} else if (p[0] == '$.') {
					p = p.substr(2);
					v = parse(p, it.$[p]);
				} else {
					v = parse(p, it[p]);
				}
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

module.exports = {
	filters: function(d) {
		return get(d, 'filters', 'filter').map(function(it) {
			return {
				name: it._,
				type: it.$.type,
			};
		});
	},

	projects: function(d) {
		return get(d, 'projects', 'project').map(use({
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
			inbox: 'fInbox'
		}));
	},

	areas: function(d) {
		return get(d, 'areas', 'area').map(use({
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
		return get(d, 'categories', 'category').map(use({
			id: 'ixCategory',
			name: 'sCategory',
			plural: 'sPlural'
		}));
	},

	priorities: function(d) {
		return get(d, 'priorities', 'priority').map(use({
			id: 'ixPriority',
			name: 'sPriority',
			isDefault: 'fDefault'
		}));
	},

	milestones: function(d) {
		return get(d, 'fixfors', 'fixfor').map(use({
			id: 'ixFixFor',
			name: 'sFixFor',
			deleted: 'fDeleted',
			project: {
				id: 'ixProject',
				name: 'sProject'
			}
		}));
	},

	people: function(d) {
		return get(d, 'people', 'person').map(use({
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
		}));
	},
	
	searchCols: 'ixBug,ixBugParent,ixBugChildren,sTitle,ixPriority,sPriority,ixCategory,sCategory,ixFixFor,sFixFor,sVersion,fOpen',

	cases: function(d) {
		return get(d, 'cases', 'case').map(use({
			id: 'ixBug',
			operations: '$.operations',
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
				name: 'sFixFor'
			},
			version: 'sVersion'
			// open: 
		}));
	}
};
