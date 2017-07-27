const Base = require('./base');

function EventSchema(customFields) {
  return {
    id: 'ixBugEvent',
    date: 'dt',
    verb: 'sVerb',
    description: 'evtDescription',
    person: {
      id: 'ixPerson',
      name: 'sPerson'
    },
    assignee: 'ixPersonAssignedTo',
    format: 'sFormat',
    text: 's',
    changes: 'sChanges',
    html: function(it) {
      var val = it.sHTML || it.sHtml;
      if (!val) {
        return undefined;
      }
      if (Array.isArray(val)) {
        val = val[0];
      }
      if (typeof val === 'string') {
        return val;
      }
      if (typeof val._ === 'string') {
        return val._;
      }
      return undefined;
    },
    isHtml: 'fHTML',
    isExternal: 'fExternal',
    isEmail: 'fEmail',
    message: {
      from: 'sFrom',
      to: 'sTo',
      cc: 'sCC',
      bcc: 'sBCC',
      replyTo: 'sReplyTo',
      subject: 'sSubject',
      date: 'sDate',
      bodyText: 'sBodyText',
      bodyHTML: 'sBodyHTML'
    },
    attachments: function(it){ 
        return it.rgAttachments[0].attachment || [];
      }
  }
}

function Event(customFields) {
  return Base.apply(this, [new EventSchema(customFields), customFields]);
}

module.exports = Event;