Package.describe({
  summary: "FogBugz client"
});

Npm.depends({
	"request": "2.30.0",
	"xml2js": "0.4.1",
	"q": "0.9.7",
	"async": "0.2.9"
});

Package.on_use(function(api) {
  api.use('underscore', ['client', 'server']);
  api.use('jquery', ['client']);
  api.use('jquery-xml2json', ['client']);

  api.export('FogBugz');

  api.add_files('fogbugz.js', ['server', 'client']);
});
