const Base = require('./base');

function PersonSchema(customFields) {
  return {
    id: 'ixPerson',
    name: 'sFullName',
    email: 'sEmail',
    phone: 'sPhone',
    admin: 'fAdministrator',
    community: 'fCommunity',
    virtual: 'fVirtual',
    deleted: 'fDeleted',
    notify: 'fNotify',
    expert: 'fExpert',
    homepage: 'sHomepage',
    locale: 'sLocale',
    language: 'sLanguage',
    workingOn: 'ixBugWorkingOn',
    timeZoneKey: 'sTimeZoneKey'
  }
}

function Person(customFields) {
  return Base.apply(this, [new PersonSchema(customFields), customFields]);
}

module.exports = Person;