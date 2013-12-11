Package.describe({
  summary: "FogBugz client"
});

Package.on_use(function(api, where) {
  api.use('underscore', ['client', 'server']);
  api.use('jquery', ['client']);
  api.use('jquery-xml2json', ['client']);

  api.export('FogBugz');

  api.add_files('fogbugz.js', ['server', 'client']);
});
