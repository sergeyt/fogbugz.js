fogbugz = require('../index')
readline = require('readline')
askFor = require('ask-for')
Q = require('q')

rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
rl.setPrompt 'fbsh'

args = null
fb = null # instance of fogbugz client

main = () -> auth repl

repl = () ->
    rl.prompt()
    rl.on('line', l -> run(l))

# runs specified line
run = (l) ->
    args = l.split(' ')
    cmd = args[0]
    switch cmd
        when 'help' then help()
        when 'ls' then ls()
        else console.log('unknown command: %s', cmd)

print = (_) -> [].slice.call(arguments, 0).forEach((x) -> console.log(JSON.stringify(x, null, 2)))

auth = (cb) ->
    if (fb)
        cb()
    else
        askFor ['fogbugz url', 'user', 'password'], (answers) ->
            options =
                url: answers['fogbugz url']
                user: answers.user,
                password: answers.password
            fogbugz(options).done client ->
                # TODO store config in secure cookie file
                fb = client
                cb()

# TODO plain print
ls = () ->
    switch args[1]
        when 'milestones'
            fb.milestones().then(print)
        else
            fb.search().then(print)

help = () ->
    console.log 'usage: fbsh <command> [<args>]'
    console.log ''
    console.log 'commands:'
    console.log '  ls        - list cases from current filter'
    console.log '  ls filtes - list available filters'
    return Q('')

main()