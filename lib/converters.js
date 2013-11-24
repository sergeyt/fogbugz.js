// converters from FogBugz XMLJS payloads to plain JS objects

var isarray = require('isarray'),
    extend = require('extend');

// resolves xmljs array
function getarr(d) {
    var arr = [d];
    for (var i = 1; i < arguments.length; i++){
        var p = arguments[i];
        var v = arr[0][p];
        if (v === null || v === undefined){
            return [];
        }
        arr = isarray(v) ? v : [v];
        if (arr.length === 0){
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
	var v = isarray(val) ? val[0] : val;
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

function get(obj, key){
    var v;
    if (/^.+\[]$/.test(key)){
        v = obj[key.substr(0, key.length - 2)] || [];
    } else {
        v = parse(key, obj[key]);
    }
    return v;
}

function mapget(arr, name){
    return arr.map(function(x){
        return get(x, name);
    });
}

function evalchain(chain, it){
    for (var i = 0; i < chain.length; i++){
        var name = chain[i];
        if (isarray(it)){
            it = mapget(it, name);
        } else {
            it = get(it, name);
        }
        if (it === null || it === undefined){
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
                    console.warn("cannot eval '%s'", chain);
                    return {};
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

module.exports = {
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
			inbox: 'fInbox'
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
			plural: 'sPlural'
		}));
	},

	priorities: function(d) {
		return getarr(d, 'priorities', 'priority').map(use({
			id: 'ixPriority',
			name: 'sPriority',
			isDefault: 'fDefault'
		}));
	},

    statuses: function(d){
        return getarr(d, 'statuses', 'status').map(use({
            id: 'ixStatus',
            name: 'sStatus',
            category: 'ixCategory',
            isResolved: 'fResolved',
            isDuplicate: 'fDuplicate',
            isDeleted: 'fDeleted',
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
			deleted: 'fDeleted'
		}));
	},

    person: function(d){
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
        'tags'
	].join(','),

	cases: function(d) {
		return getarr(d, 'cases', 'case').map(use({
			id: 'ixBug',
			status: {
				id: 'ixStatus',
				name: 'sStatus'
			},
			operations: '$.operations',
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
				name: 'sFixFor'
			},
			version: 'sVersion',
			computer: 'sComputer',
			ticket: 'sTicket',
			latestSummary: 'sLatestTextSummary',
			isOpen: 'fOpen',
            tags: 'tags.tag[]._'
		}));
	},
	
	events: function(d) {
		return getarr(d, 'cases', 'case', 'events', 'event').map(use({
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
			html: 'sHtml'
		}));
	}
};
