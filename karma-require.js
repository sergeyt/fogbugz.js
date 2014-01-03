// simple require for tests running in browser by karma-runner
window.require = function(name){

	var mods = [
		[/fogbugz/, window.fogbugz],
		[/expect.js/, window.expect],
		[/underscore/, window._],
	];

	var mod = _.find(mods, function(m){
		return m[0].test(name);
	});

	return mod ? mod[1] : null;
};