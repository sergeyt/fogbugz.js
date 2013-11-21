fs = require('fs')
fogbugz = require('../index')
read = require('read')
askfor = require('askfor')
Table = require('cli-table')

# instance of fogbugz client
fb = null
# promise duck
done = {done: (cb) -> cb()}

main = () -> auth repl
repl = () -> read {prompt: 'fbsh> '}, (err, l) -> run(l).done(repl)

# runs specified line
run = (l) ->
    args = l.split(' ').filter((w) -> !!w)
    cmd = args[0]
    switch cmd
        when 'help' then help()
        when 'ls' then ls(args)
        when 'q' then process.exit(0)
        else
            console.log('unknown command: %s', cmd)
            done

# CONFIG
cfgfile = __dirname + '/fbsh.conf.json'

auth = (cb) ->
    if (fs.existsSync(cfgfile))
        options = require(cfgfile)
        if (options.token)
            start options, false, cb
        else
            askcfg cb
    else
        askcfg cb

askcfg = (cb) ->
    askfor ['fogbugz url', 'user', 'password'], (answers) ->
        options =
            url: answers['fogbugz url']
            user: answers.user,
            password: answers.password
        start options, true, cb

start = (options, updateConfig, cb) ->
    p = fogbugz(options)
    p.fail (error) ->
        console.log(error)
        # TODO auth again
        process.exit(-1)
    p.done (client) ->
        if (updateConfig)
            delete options.password
            options.token = client.token
            fs.writeFileSync(cfgfile, toJson(options), 'utf8')
        fb = client
        cb()

# TODO plain print
ls = (args) ->
    switch args[1]
        when 'm'
            fb.milestones().then(printJson)
        when 'f'
            fb.filters().then(printJson)
        else
            fb.search().then(printCases)

help = () ->
    console.log 'commands:'
    console.log '  ls        - list cases from current filter'
    console.log '  ls filtes - list available filters'
    done

# utils
toJson = (x) -> JSON.stringify(x, null, 2)
printJson = (_) -> [].slice.call(arguments, 0).forEach((x) -> console.log(toJson(x)))

printCases = (list) ->
    table = new Table({
        head: ['#', 'title'],
        colWidths: [8, 100]
    })
    table.push.apply(table, list.map((x) -> [x.id || 0, x.title || '']))
    console.log(table.toString())

main()