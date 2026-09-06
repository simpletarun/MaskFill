/* MaskFill - form field detection & classification (classic script, shared isolated world) */
(function () {
  'use strict';

  function sanitize(str) {
    return String(str == null ? '' : str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function deepQuery(root) {
    var out = [];
    try {
      if (root && root.matches && root.matches('input, textarea, select, [contenteditable="true"]')) out.push(root);
      var direct = root.querySelectorAll('input, textarea, select, [contenteditable="true"]');
      for (var i = 0; i < direct.length; i++) out.push(direct[i]);
      var all = root.querySelectorAll('*');
      for (var j = 0; j < all.length; j++) {
        var sr = all[j].shadowRoot;
        if (sr) {
          var sub = deepQuery(sr);
          for (var k = 0; k < sub.length; k++) out.push(sub[k]);
        }
      }
    } catch (e) {}
    return out;
  }

  function detectFields(root) {
    return deepQuery(root);
  }

  function isIgnorable(el, ignorePatterns) {
    var type = String(el.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].indexOf(type) !== -1) return true;
    if (el.hasAttribute('disabled') || el.hasAttribute('readonly')) return true;
    if (el.hasAttribute('hidden')) return true;
    if (el.getAttribute('aria-hidden') === 'true') return true;
    try { if (el.closest && el.closest('[aria-hidden="true"]')) return true; } catch (e) {}
    // hidden-styled radios/checkboxes are still real answers (custom MCQs render the input invisible
    // and style a label); only style-skip text-like inputs
    var isChoice = type === 'radio' || type === 'checkbox';
    if (typeof getComputedStyle === 'function' && !isChoice) {
      try {
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      } catch (e) {}
    }
    var joined = sanitize([
      el.getAttribute('name') || '',
      el.getAttribute('placeholder') || '',
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute('aria-label') || ''
    ].join(' '));
    var pats = ignorePatterns || [];
    for (var i = 0; i < pats.length; i++) {
      var raw = String(pats[i]).toLowerCase().trim();
      if (!raw) continue;
      if (joined.indexOf(raw) !== -1 || joined.indexOf(sanitize(raw)) !== -1) return true;
    }
    return false;
  }

  function bestLabel(el) {
    var id = el.id;
    if (id && typeof document !== 'undefined') {
      var labels = document.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].getAttribute('for') === id) {
          var txt = labels[i].textContent || '';
          return txt.replace(/\s+/g, ' ').trim();
        }
      }
    }
    var wrap = el.closest && el.closest('label');
    if (wrap && wrap.textContent) {
      var wt = wrap.textContent;
      return wt.replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  function ariaLabelledbyText(el) {
    var lb = el.getAttribute && el.getAttribute('aria-labelledby');
    if (!lb) return '';
    if (typeof document === 'undefined') return '';
    var out = '';
    var refs = lb.split(/\s+/);
    for (var j = 0; j < refs.length; j++) {
      var ref = refs[j];
      if (!ref) continue;
      var elRef = document.getElementById(ref);
      if (elRef && elRef.textContent) out += ' ' + elRef.textContent;
    }
    return out.replace(/\s+/g, ' ').trim();
  }

  function getElementSignals(el, matchBy) {
    matchBy = matchBy || { name: true, id: true, className: false, placeholder: true, label: true, ariaLabel: true, ariaLabelledby: true };
    var signals = [];
    function push(v) {
      var s = sanitize(v);
      if (s && signals.indexOf(s) === -1) signals.push(s);
    }
    var name = el.getAttribute && el.getAttribute('name');
    var placeholder = el.getAttribute && el.getAttribute('placeholder');
    var ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    var autocomplete = el.getAttribute && el.getAttribute('autocomplete');
    var className = typeof el.className === 'string' ? el.className : '';

    if (autocomplete) {
      var tokens = String(autocomplete).toLowerCase().split(/[\s]+/);
      for (var a = 0; a < tokens.length; a++) {
        if (!tokens[a]) continue;
        push(tokens[a]);
        push(tokens[a].replace(/[^a-z0-9]+/g, ' '));
      }
    }
    if (matchBy.name && name) push(name);
    if (matchBy.id && el.id) push(el.id);
    if (matchBy.className && className) {
      className.split(/\s+/).forEach(function (c) { if (c) push(c); });
    }
    if (matchBy.placeholder && placeholder) push(placeholder);
    if (matchBy.label) push(bestLabel(el));
    if (matchBy.ariaLabel && ariaLabel) push(ariaLabel);
    if (matchBy.ariaLabelledby) { var alb = ariaLabelledbyText(el); if (alb) push(alb); }
    var im = el.getAttribute && el.getAttribute('inputmode');
    if (im === 'numeric' || im === 'decimal' || im === 'tel') push(im);

    var tag = String(el.tagName || '').toLowerCase();
    var kind;
    if (tag === 'select') kind = 'select';
    else if (tag === 'textarea') kind = 'textarea';
    else if (el.getAttribute && el.getAttribute('contenteditable') === 'true') kind = 'contenteditable';
    else kind = el.type || 'text';

    var opts = [];
    if (tag === 'select' && el.options) opts = Array.prototype.slice.call(el.options);
    else if (el.list && el.list.options) opts = Array.prototype.slice.call(el.list.options);

    return {
      el: el,
      signals: signals,
      name: name || '',
      id: el.id || '',
      placeholder: placeholder || '',
      label: bestLabel(el),
      ariaLabel: ariaLabel || '',
      type: kind,
      pattern: (el.getAttribute && el.getAttribute('pattern')) || '',
      maxlength: typeof el.maxLength === 'number' ? el.maxLength : -1,
      minlength: (function () { var v = parseInt(el.getAttribute && el.getAttribute('minlength'), 10); return isNaN(v) ? -1 : v; })(),
      min: (el.getAttribute ? el.getAttribute('min') : '') || '',
      max: (el.getAttribute ? el.getAttribute('max') : '') || '',
      step: (el.getAttribute ? el.getAttribute('step') : '') || '',
      autocomplete: autocomplete || '',
      options: opts,
      tag: tag
    };
  }

  var RULES = [
    [/confirm.{0,12}password|password.{0,12}confirm|retype.{0,12}password|password.{0,12}retype|repeat.{0,12}password|password.{0,12}repeat|reenter.{0,12}password|password.{0,12}reenter/, 'password'],
    [/\b(?:e[ -]?mail|email)\b/, 'email'],
    [/\bip ?v6 ?address\b/, 'ipv6'],
    [/\bip ?address\b/, 'ip'],
    [/\b(?:first ?name|given ?name|fname)\b/, 'firstName'],
    [/\b(?:last ?name|family ?name|surname|lname)\b/, 'lastName'],
    [/\bmiddle ?name\b/, 'middleName'],
    [/\b(?:nick ?name|nickname|handle)\b/, 'nickname'],
    [/\b(?:user ?name|username|login|screen ?name)\b/, 'username'],
    [/\b(?:full ?name|your ?name)\b/, 'fullName'],
    [/\bname\b/, 'fullName'],
    [/\b(?:date ?of ?birth|dob|birth ?date|birthday|birth ?day)\b/, 'dob'],
    [/\bage\b/, 'age'],
    [/\b(?:gender|sex)\b/, 'gender'],
    [/\bnationalit/, 'nationality'],
    [/\b(?:mobile|cell)\b/, 'mobile'],
    [/\b(?:phone|telephone)\b/, 'phone'],
    [/\bcontact\b(?!\s?(?:name|person|email))/i, 'phone'],
    [/\bfax\b/, 'phone'],
    [/\b(?:password|pwd|passcode|pass)\b/, 'password'],
    [/\b(?:credit ?card|card ?number|cardnum|card)\b/, 'creditCard'],
    [/\b(?:cvv|cvc|security ?code|verification ?code)\b/, 'cvv'],
    [/\biban\b/, 'iban'],
    [/\b(?:swift|bic)\b/, 'swift'],
    [/\b(?:bank ?account|bankaccount|account ?number|routing)\b/, 'bankAccount'],
    [/\b(?:ssn|social ?security)\b/, 'ssn'],
    [/\b(?:tax ?id|taxid|tin|ein)\b/, 'taxId'],
    [/\bpassport\b/, 'passport'],
    [/\b(?:driver ?s?license|licen[cs]e ?number|reg ?no|regno)\b/, 'driversLicense'],
    [/\b(?:house ?(?:number|no)|housenumber|houseno)\b/, 'buildingNumber'],
    [/\b(?:building ?number|buildingno)\b/, 'buildingNumber'],
    [/\b(?:street ?address|address ?1|address ?line ?1|location|addr)\b/, 'streetAddress'],
    [/\b(?:address ?2|address ?line ?2|address2)\b/, 'addressLine2'],
    [/\b(?:apt|apartment|suite|unit|flat)\b/, 'apartment'],
    [/\b(?:street|address|block)\b/, 'streetAddress'],
    [/\b(?:city|town|municipalit)/, 'city'],
    [/\b(?:state ?code|province ?code)\b/, 'stateCode'],
    [/\b(?:state|province|region|county)\b/, 'state'],
    [/\b(?:zip ?code|zipcode|postal ?code|postcode|postal|pin ?code|pincode|zip)\b/, 'zip'],
    [/\b(?:country ?code|countrycode|cc)\b/, 'countryCode'],
    [/\bcountry\b/, 'country'],
    [/\b(?:coordinates?|geo)\b|lat.{0,12}(?:long|lng|lon)/, 'coordinates'],
    [/\b(?:latitude|lat)\b/, 'latitude'],
    [/\b(?:longitude|lng|lon)\b/, 'longitude'],
    [/\b(?:time ?zone|timezone|tz|utc|gmt)\b/, 'timezone'],
    [/\b(?:company ?id|org ?id|employer ?id)\b/, 'companyId'],
    [/\b(?:company ?website|company ?site)\b/, 'companyWebsite'],
    [/\b(?:company|organization|employer|org)\b/, 'company'],
    [/\b(?:job ?title|jobtitle|position|designation|occupation|role(?!.*select)|profession)\b/, 'jobTitle'],
    [/\b(?:department|dept)\b/, 'department'],
    [/\b(?:industry|sector)\b/, 'industry'],
    [/\b(?:university|college)\b/, 'university'],
    [/\b(?:high ?school|school)\b/, 'school'],
    [/\b(?:degree|major|qualification|education)\b/, 'degree'],
    [/\b(?:honorific|title|salutation|prefix)\b/, 'prefix'],
    [/\bsuffix\b/, 'suffix'],
    [/\b(?:website|web ?site|homepage|site|url|link)\b/, 'url'],
    [/\b(?:user ?id|userid)\b/, 'userId'],
    [/\b(?:order ?id|orderid)\b/, 'orderId'],
    [/\b(?:invoice ?id|invoice ?no|invoice)\b/, 'invoiceId'],
    [/\b(?:product ?id|productid|sku)\b/, 'productId'],
    [/\b(?:transaction ?id|txn ?id)\b/, 'uuid'],
    [/\b(?:uuid|guid|unique ?id)\b/, 'uuid'],
    [/\b(?:ip ?v6|ipv6)\b/, 'ipv6'],
    [/\b(?:mac ?address|mac)\b/, 'mac'],
    [/\b(?:domain ?name|domain|hostname)\b/, 'domain'],
    [/\b(?:sub ?domain|subdomain)\b/, 'subdomain'],
    [/\bcidr\b/, 'cidr'],
    [/\bport\b/, 'port'],
    [/\b(?:ip ?address|ip|host(?!name))\b/, 'ip'],
    [/\b(?:otp|one ?time|one ?time ?(?:code|password)|verify ?code|auth ?code|two ?factor|2fa|mfa)\b/, 'otp'],
    [/\b(?:security ?pin|pin)\b/, 'pin'],
    [/\b(?:secret ?question|security ?question|secret ?answer|security ?answer|sq ?answer)\b/, 'securityAnswer'],
    [/\b(?:datetime|date ?time|timestamp)\b/, 'datetimeLocal'],
    [/\b(?:start ?date|end ?date|from ?date|to ?date|datepicker|date)\b/, 'date'],
    [/\b(?:time|hour|start ?time|duration)\b/, 'time'],
    [/\bmonth\b/, 'month'],
    [/\b(?:week|wk|ww)\b/, 'week'],
    [/\b(?:birth ?year|year|yyyy)\b/, 'year'],
    [/\b(?:percent|percentage)\b/, 'percentage'],
    [/\b(?:currency ?code|currency|iso ?4217)\b/, 'currencyCode'],
    [/\b(?:amount|total|balance|salary|income|money)\b/, 'amount'],
    [/\b(?:price|cost|value(?!.*card)|billing|budget)\b/, 'price'],
    [/\b(?:quantity|qty|count|stock|months|years|participants|guests|items|units)\b/, 'quantity'],
    [/\b(?:number|numeric|integer|index(?!.*code))\b/, 'number'],
    [/\b(?:search|searchquery)\b/, 'search'],
    [/\b(?:comment|feedback|message|question|notes|note|details|description|bio|about|suggestions|suggestion)\b/, 'bio'],
    [/\b(?:paragraph|instructions|instruction|summary|abstract)\b/, 'paragraph'],
    [/\b(?:keywords|keyword|tags|tag|words)\b(?!.*slug)/, 'words'],
    [/\b(?:slug|permalink)\b/, 'slug'],
    [/\b(?:file ?name|filename)\b/, 'filename'],
    [/\b(?:file ?ext|extension)\b/, 'fileExt'],
    [/\b(?:mime ?type|mimetype)\b/, 'mimeType'],
    [/\bsentence\b/, 'sentence'],
    [/\bhex(?:adecimal)?\b/, 'hexColor'],
    [/\bcolor\b(?! ?code)/, 'color'],
    [/\b(?:yes|no)\b|\bagree(?:d)?.{0,12}term\b|\bconsent\b|\bopt ?in\b|\bsubscribe\b|\bnewsletter\b|\bremember ?me\b|\baccept(?:ed)?.{0,12}term\b/, 'boolean']
  ];

  var MERGED = [
    ['creditcardnumber', 'creditCard'],
    ['creditcard', 'creditCard'],
    ['cardnumber', 'creditCard'],
    ['accountnumber', 'bankAccount'],
    ['bankaccount', 'bankAccount'],
    ['cvvnumber', 'cvv'],
    ['phonenumber', 'phone'],
    ['telephonenumber', 'phone'],
    ['mobilenumber', 'mobile'],
    ['mobileno', 'mobile'],
    ['cellnumber', 'mobile'],
    ['cellno', 'mobile'],
    ['phoneno', 'phone'],
    ['contactnumber', 'phone'],
    ['contactno', 'phone'],
    ['firstname', 'firstName'],
    ['lastname', 'lastName'],
    ['middlename', 'middleName'],
    ['fullname', 'fullName'],
    ['custname', 'fullName'],
    ['cardname', 'fullName'],
    ['contactperson', 'fullName'],
    ['dateofbirth', 'dob'],
    ['username', 'username'],
    ['password', 'password'],
    ['passwd', 'password'],
    ['passw', 'password'],
    ['zipcode', 'zip'],
    ['postcode', 'zip'],
    ['pincode', 'zip'],
    ['emailaddress', 'email'],
    ['emailid', 'email'],
    ['mailid', 'email'],
    ['emailaddr', 'email'],
    ['emailadd', 'email'],
    ['taxid', 'taxId'],
    ['driverslicense', 'driversLicense'],
    ['passportnumber', 'passport'],
    ['ipaddress', 'ip'],
    ['macaddress', 'mac'],
    ['domainname', 'domain'],
    ['jobtitle', 'jobTitle'],
    ['websiteurl', 'url'],
    ['streetaddress', 'streetAddress'],
    ['datetime', 'datetimeLocal'],
    ['expirationdate', 'date'],
    ['expdate', 'date'],
    ['orderid', 'orderId'],
    ['invoiceid', 'invoiceId'],
    ['productid', 'productId'],
    ['userid', 'userId'],
    ['phonenum', 'phone'],
    ['telnum', 'phone'],
    ['phn', 'phone'],
    ['mobilenumber', 'mobile'],
    ['cellnum', 'mobile'],
    ['mobilenum', 'mobile'],
    ['companyid', 'companyId']
  ];

  function detectTypeFromSignals(signals) {
    if (!signals || !signals.length) return null;
    var joined = signals.map(String).join(' ').toLowerCase();
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i][0].test(joined)) return RULES[i][1];
    }
    for (var j = 0; j < MERGED.length; j++) {
      if (joined.indexOf(MERGED[j][0]) !== -1) return MERGED[j][1];
    }
    return null;
  }

  var AUTOCOMPLETE_MAP = {
    'given-name': 'firstName',
    'family-name': 'lastName',
    'additional-name': 'middleName',
    'nickname': 'nickname',
    'bday': 'dob',
    'bday-day': 'number',
    'bday-month': 'month',
    'bday-year': 'year',
    'email': 'email',
    'tel': 'phone',
    'tel-national': 'phone',
    'tel-area-code': 'phone',
    'street-address': 'streetAddress',
    'address-line1': 'streetAddress',
    'address-line2': 'addressLine2',
    'address-level2': 'city',
    'address-level1': 'state',
    'postal-code': 'zip',
    'country-name': 'country',
    'country': 'countryCode',
    'organization': 'company',
    'organization-title': 'jobTitle',
    'username': 'username',
    'current-password': 'password',
    'new-password': 'password',
    'cc-name': 'fullName',
    'cc-number': 'creditCard',
    'cc-csc': 'cvv',
    'cc-exp': 'month',
    'cc-exp-month': 'month',
    'cc-exp-year': 'year',
    'url': 'url'
  };

  function autocompleteType(el) {
    var raw = el.getAttribute && el.getAttribute('autocomplete');
    if (!raw) return null;
    var v = String(raw).toLowerCase().trim();
    if (v === 'off' || v === 'on') return null;
    var tokens = v.split(/\s+/);
    var token = '';
    for (var i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i]) { token = tokens[i]; break; }
    }
    if (token === 'off' || token === 'on') return null;
    return AUTOCOMPLETE_MAP[token] || null;
  }

  var CONFIRM_RE = /confirm|re-?enter|retype|repeat|secondary/i;

  function isConfirmation(str) {
    return CONFIRM_RE.test(String(str || ''));
  }

  var STRONG = {
    email: 'email',
    tel: 'phone',
    number: 'number',
    range: 'number',
    password: 'password',
    search: 'search',
    url: 'url',
    date: 'date',
    time: 'time',
    'datetime-local': 'datetimeLocal',
    datetime: 'datetimeLocal',
    month: 'month',
    week: 'week',
    color: 'hexColor'
  };

  function detectType(el, matchBy) {
    var ac = autocompleteType(el);
    if (ac) return ac;
    var tag = String(el.tagName || '').toUpperCase();
    var typeAttr = String((el.getAttribute && el.getAttribute('type')) || '').toLowerCase();
    if (typeAttr === 'checkbox' || typeAttr === 'radio') {
      var d = detectTypeFromSignals(getElementSignals(el, matchBy).signals);
      return d === 'boolean' ? null : d;
    }
    if (STRONG[typeAttr]) {
    if (typeAttr === 'number') {
      var signalType = detectTypeFromSignals(getElementSignals(el, matchBy).signals);
      return signalType !== null ? signalType : 'number';
    }
    if (typeAttr === 'date') {
      // a type=date field marked as a birth date must fill an adult DOB, not a recent date
      var bdaySignal = detectTypeFromSignals(getElementSignals(el, matchBy).signals);
      if (bdaySignal === 'dob' || bdaySignal === 'year') return bdaySignal;
    }
    return STRONG[typeAttr];
  }
    if (tag === 'SELECT') return null;
    var signals = getElementSignals(el, matchBy).signals;
    if (tag === 'TEXTAREA') {
      var t = detectTypeFromSignals(signals);
      if (t === 'bio' || t === 'paragraph' || t === 'sentence' || t === 'words' || t === 'text') return t;
      return 'paragraph';
    }
    if ((el.getAttribute && el.getAttribute('contenteditable') === 'true') || el.isContentEditable) return 'paragraph';
    return detectTypeFromSignals(signals);
  }

  function groupRadios(el) {
    var name = el.name;
    if (!name) return [el];
    var out = [el];
    var scope = el.form || (typeof document !== 'undefined' ? document : null);
    if (scope) {
      var all = scope.querySelectorAll('input[type="radio"]');
      for (var i = 0; i < all.length; i++) {
        if (all[i] !== el && all[i].name === name) out.push(all[i]);
      }
    }
    return out;
  }

  function hasValue(el) {
    var tag = String(el.tagName || '').toUpperCase();
    if (tag === 'SELECT') {
      if (el.selectedIndex < 0) return false;
      var opt = el.options && el.options[el.selectedIndex];
      return Boolean(opt && String(opt.value || '').trim());
    }
    var type = String(el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return el.checked;
    if (el.isContentEditable) return String(el.textContent || '').trim() !== '';
    var raw = String(el.value || '').trim();
    // a lone country-code prefix like "+91" is not a real value; the field is still empty
    if (tag === 'INPUT' && /^\+[0-9]{1,3}[-\s.]*$/.test(raw)) return false;
    // default zeros ("0") and mask chips ("--", "__/__/____") are placeholders, not answers
    if (tag === 'INPUT' && (/^[+\-]?(0+(\.0+)?|\.0+)$/.test(raw) || /^[_\-.·~]+$/.test(raw))) return false;
    return raw !== '';
  }

  var FieldDetector = {
    sanitize: sanitize,
    detectFields: detectFields,
    isIgnorable: isIgnorable,
    getElementSignals: getElementSignals,
    detectType: detectType,
    autocompleteType: autocompleteType,
    detectTypeFromSignals: detectTypeFromSignals,
    isConfirmation: isConfirmation,
    groupRadios: groupRadios,
    hasValue: hasValue
  };

  window.FieldDetector = FieldDetector;
  if (typeof module !== 'undefined' && module.exports) module.exports = FieldDetector;
})();