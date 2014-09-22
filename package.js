Package.describe({
  name: "sergeyt:fogbugz",
  summary: "FogBugz client for nodejs, meteor and browser.",
  git: "https://github.com/sergeyt/fogbugz.js",
  version: "0.0.32"
});

Npm.depends({
	"request": "2.33.0",
	"xml2js": "0.4.1",
	"q": "1.0.0",
	"underscore": "1.5.2",
	"async": "0.2.9"
});

Package.onUse(function(api) {
  var anywhere = ['client', 'server'];
  var client = ['client'];
  api.use('underscore', anywhere);
  api.use('jquery', client);
  api.use('jquery-xml2json', client);
  api.export('FogBugz');
  api.addFiles('fogbugz.js', anywhere);
});

