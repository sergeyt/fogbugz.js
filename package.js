Package.describe({
  summary: "FogBugz client"
});

Package.on_use(function(api, where) {
  api.use('underscore', ['client', 'server']);
  api.use('jquery', ['client']);

  api.export('FogBugz');

  // TODO add client when it will be supported in browser
  api.add_files('fogbugz.js', ['server']);
});
