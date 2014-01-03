fogbugz = require '../fogbugz'
expect = require 'expect.js'
_ = require 'underscore'

endpoint = 'http://fb.com'

# creates fake request function
fakeRequest = ->
	responses = []
	req = (url, cb) ->
		r = _.find responses, (x) ->
			if typeof x[0] is 'function' and x[0](url) then true
			else if x[0].test(url) then true
			else false
		if !r
			cb url + ' is not routed', null, null
			return
		if typeof r[1] is 'string'
			# TODO provide response object
			cb null, {}, r[1]
			return
		throw new Error('not implemented!')

	req.get = req

	req.on = (matcher, response) ->
		if typeof matcher is 'string'
			matcher = new RegExp(matcher)
		responses.push [matcher, response]

	return req

create = (request) ->
	fogbugz
		url: endpoint
		email: 'test@test.com'
		password: '1'
		request: request

describe 'with fogbugz client', ->
	describe 'on login', ->
		it 'should parse api token', (done) ->
			req = do fakeRequest
			req.on /cmd=logon/, '<response><token>test</token></response>'
			create(req).then (fb) ->
				expect(fb.token).to.be('test')
				done()
