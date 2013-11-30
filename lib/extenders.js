var extend = require('extend');

// extend functions for fogbugz objects
module.exports = {
	milestone: function(fb) {
		return function(it) {
			return extend(it, {
				cases: function() {
					var q = "";
					if (it.project && it.project.name){
						q += 'project:' + it.project.name + ' ';
					}
					q += 'fixfor:' + it.name;
					return fb.search(q);
				}
			});
		};
	} // ,
//	'case': function(fb) {
//		return function(it) {
//			return extend(it, {
//				events: function() { return fb.events(it.id); }
//			});
//		};
//	}
};