var extend = require('extend');

// extend functions for fogbugz objects
module.exports = {
	milestone: function(fb) {
		return function(it) {
			return extend(it, {
				cases: function() { return fb.search('fixfor:' + it.id); }
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