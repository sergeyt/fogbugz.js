var extend = require('extend');

// extend functions for fogbugz objects
module.exports = {
	milestone: function(fb) {
		return function(m) {
			return extend(m, {
				cases: function() {
					return fb.search('fixfor:' + m.id);
				}
			});
		};
	}
};