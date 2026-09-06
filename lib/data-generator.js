'use strict';
(function () {
  var F = window.__FAKER__ || {};
  var _defF = window.__FAKER__ || {};

  var _persona = null;
  var _password = null;
  var _confirmPassword = null;
  var _consistent = false;
  var _locale = 'en';

  var _HI_FIRST = ['अमित', 'अनु', 'अर्जुन', 'आरव', 'आशा', 'इशा', 'ऋषि', 'कविता', 'कृष्ण', 'गौरव', 'दीपा', 'देव', 'नम्रता', 'निखिल', 'पूजा', 'प्रिया', 'भावना', 'मनीष', 'मीरा', 'मोहित', 'रजनी', 'राहुल', 'रीना', 'रोहन', 'लक्ष्मी', 'वरुण', 'विक्रम', 'विजय', 'शिखा', 'शीला', 'सचिन', 'सलोनी', 'सुमन', 'सोनिया', 'हरि', 'हेमा'];
  var _HI_FIRST_LATIN = ['Amit', 'Anu', 'Arjun', 'Aarav', 'Aasha', 'Isha', 'Rishi', 'Kavita', 'Krishna', 'Gaurav', 'Deepa', 'Dev', 'Namrata', 'Nikhil', 'Pooja', 'Priya', 'Bhavana', 'Manish', 'Meera', 'Mohit', 'Rajni', 'Rahul', 'Reena', 'Rohan', 'Lakshmi', 'Varun', 'Vikram', 'Vijay', 'Shikha', 'Sheela', 'Sachin', 'Saloni', 'Suman', 'Sonia', 'Hari', 'Hema'];
  var _HI_LAST = ['अग्रवाल', 'गांधी', 'चौहान', 'चोपड़ा', 'जोशी', 'तिवारी', 'दास', 'देशपांडे', 'नायर', 'पटेल', 'प्रसाद', 'बंसल', 'बत्रा', 'मिश्रा', 'मेहता', 'राव', 'रेड्डी', 'वर्मा', 'सक्सेना', 'सिंह', 'सिन्हा', 'शर्मा', 'श्रीवास्तव', 'खन्ना'];
  var _HI_LAST_LATIN = ['Agarwal', 'Gandhi', 'Chauhan', 'Chopra', 'Joshi', 'Tiwari', 'Das', 'Deshpande', 'Nair', 'Patel', 'Prasad', 'Bansal', 'Batra', 'Mishra', 'Mehta', 'Rao', 'Reddy', 'Verma', 'Saxena', 'Singh', 'Sinha', 'Sharma', 'Srivastava', 'Khanna'];
  var _EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com'];

  function ensurePersona() {
    if (!_persona) RandomData.getPersona();
    return _persona;
  }

  function personaLock(key, genFn) {
    if (!_consistent) return genFn();
    var p = ensurePersona();
    if (p[key] === undefined) p[key] = genFn();
    return p[key];
  }

  function personaPhone() {
    return personaLock('phone', function () { return generatePhone({ htmlType: 'tel' }); });
  }

  function randomDigits(len, mobileStyle) {
    var r = '';
    if (mobileStyle && len === 10) r += String(6 + Math.floor(Math.random() * 4));
    else r += String(Math.floor(Math.random() * 10));
    for (var i = 1; i < len; i++) r += String(Math.floor(Math.random() * 10));
    return r;
  }

  function normMobile10(v) {
    var s = String(v == null ? '' : v);
    if (/^[0-5]\d{9}$/.test(s)) return String(6 + Math.floor(Math.random() * 4)) + s.substring(1);
    return s;
  }

  function stripPhoneExt(v) {
    var s = String(v == null ? '' : v).replace(/\s?x\d{1,6}\b/i, '').trim();
    return s;
  }

  var TEMPLATE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  function genTemplate(t) {
    if (!t) return safe(F.lorem && F.lorem.word)();
    var out = '';
    var str = String(t);
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i);
      if (c === '#') out += String(Math.floor(Math.random() * 10));
      else if (c === 'X') out += TEMPLATE_CHARS.charAt(Math.floor(Math.random() * 26));
      else if (c === 'x') out += TEMPLATE_CHARS.charAt(26 + Math.floor(Math.random() * 26));
      else if (c === '?') out += TEMPLATE_CHARS.charAt(Math.floor(Math.random() * TEMPLATE_CHARS.length));
      else out += c;
    }
    return out;
  }

  function generatePhone(opts) {
    var p = opts && opts.pattern;
    if (p && /^[\d\s.\-+()\[\]{},*?|a-zA-Z:^$\\]+$/.test(p) && /\\d|\[[^\]]*0-9[^\]]*\]/.test(p)) {
      var result = RandomData.regexGenerate(p);
      if (result) return normMobile10(stripPhoneExt(result));
    }
    var ml = opts && Number(opts.maxlength);
    if (ml && ml > 0) {
      if (ml >= 7 && ml <= 20) return randomDigits(ml, ml === 10);
      return randomDigits(10, true);
    }
    if (opts && opts.htmlType === 'tel') return randomDigits(10, true);
    var phone = safe(F.phone && F.phone.number)();
    if (!phone) return randomDigits(10, true);
    return normMobile10(stripPhoneExt(phone));
  }

  function safe(fn) {
    if (typeof fn !== 'function') return function () { return ''; };
    return function () {
      try { return fn.apply(null, arguments); }
      catch (e) { return ''; }
    };
  }

  var RandomData = {
    beginFill: function () { _persona = null; _password = null; _confirmPassword = null; },

    setConsistent: function (v) { _consistent = !!v; if (!_consistent) _persona = null; },

    setLocale: function (locale) {
      _locale = locale || 'en';
      var inst = (window.__FAKERS__ && window.__FAKERS__[locale]) || window.__FAKER__;
      if (inst) F = inst;
    },

    getPersona: function () {
      if (_persona) return _persona;
      var fn, ln, latFn, latLn;
      if (_locale === 'hi') {
        var hiIdx = Math.floor(Math.random() * _HI_FIRST.length);
        var hiLst = Math.floor(Math.random() * _HI_LAST.length);
        fn = _HI_FIRST[hiIdx]; ln = _HI_LAST[hiLst];
        latFn = _HI_FIRST_LATIN[hiIdx]; latLn = _HI_LAST_LATIN[hiLst];
      } else {
        fn = safe(F.person && F.person.firstName)();
        ln = safe(F.person && F.person.lastName)();
        latFn = fn; latLn = ln;
      }
      function ascii(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[.\-_]+|[.\-_]+$/g, '');
      }
      var asciiLocal = ascii(fn + '.' + ln);
      var emailLocal = asciiLocal || ('user' + Math.floor(Math.random() * 10000));
      var userBase = ascii(fn + ln) || ('user' + Math.floor(Math.random() * 10000));
      function safeEmail() {
        try {
          if (_locale === 'hi') {
            var hiLocal = ascii(latFn + '.' + latLn) || ('user' + Math.floor(Math.random() * 10000));
            return hiLocal + '@' + _EMAIL_DOMAINS[Math.floor(Math.random() * _EMAIL_DOMAINS.length)];
          }
          if (asciiLocal === '') return 'user' + Math.floor(Math.random() * 10000) + '@' + safeDomain();
          if (F.internet && F.internet.email) {
            var e = String(F.internet.email({ firstName: latFn, lastName: latLn }));
            var eLoc = e.split('@')[0];
            // ponytail: drop machine-mangled faker emails (long digit-heavy local parts), fall back to clean build
            if (e && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(e) && eLoc.length <= 24) return e;
          }
        } catch (err) {}
        return emailLocal + '@' + safeDomain();
      }
      function safeDomain() {
        return _EMAIL_DOMAINS[Math.floor(Math.random() * _EMAIL_DOMAINS.length)];
      }
      function safeUsername() {
        if (_locale === 'hi') {
          var hiUser = ascii(latFn + latLn);
          return hiUser || 'user' + Math.floor(Math.random() * 10000);
        }
        try {
          var u = F.internet && (F.internet.username || F.internet.userName);
          if (u) {
            var un = u({ firstName: latFn, lastName: latLn });
            if (un && /^[a-z0-9._-]+$/i.test(String(un))) return String(un);
          }
        } catch (err) {}
        return userBase;
      }
      _persona = {
        firstName: fn,
        lastName: ln,
        fullName: (function () {
          if (_locale === 'hi') return fn + ' ' + ln;
          try { return F.person && F.person.fullName ? F.person.fullName() : fn + ' ' + ln; } catch (e) { return fn + ' ' + ln; }
        })(),
        email: safeEmail(),
        username: safeUsername()
      };
      return _persona;
    },

    getPassword: function (settings, isConfirm) {
      if (isConfirm) {
        if (_confirmPassword !== null) return _confirmPassword;
        _confirmPassword = this.getPassword(settings, false);
        return _confirmPassword;
      }
      var explicit = settings && settings.passwordValue ? String(settings.passwordValue) : '';
      if (explicit) {
        _password = explicit;
        return _password;
      }
      if (_password !== null) return _password;
      var base = safe(F.internet && F.internet.password)({ length: 12 }) || 'Password123';
      if (!/\d/.test(base)) base += '7';
      if (!/[!@#$%^&*]/.test(base)) base += '!';
      _password = base;
      return _password;
    },

    regexGenerate: function (pattern) {
      if (!pattern) return safe(F.lorem && F.lorem.word)();
      var p = String(pattern);
      function rnd(a, b) { return F.number && F.number.int ? F.number.int({ min: a, max: b }) : a; }
      function rep(st, n) { var o = ''; for (var k = 0; k < n; k++) o += st; return o; }
      function splitAlt(s) {
        var alts = [], cur = '', d = 0;
        for (var k = 0; k < s.length; k++) {
          var c = s[k];
          if (c === '(') d++;
          else if (c === ')') d--;
          if (c === '|' && d === 0) { alts.push(cur); cur = ''; continue; }
          cur += c;
        }
        alts.push(cur);
        return alts;
      }
      function charClass(inner) {
        var neg = inner.charAt(0) === '^';
        if (neg) inner = inner.substring(1);
        var cs = [];
        for (var k = 0; k < inner.length; k++) {
          if (inner[k] === '\\' && k + 1 < inner.length) { cs.push(inner[k + 1]); k++; continue; }
          if (inner[k] === '-' && k > 0 && k + 1 < inner.length) {
            var lo = cs.pop();
            for (var cc = lo.charCodeAt(0) + 1; cc <= inner[k + 1].charCodeAt(0); cc++) cs.push(String.fromCharCode(cc));
            k++; continue;
          }
          cs.push(inner[k]);
        }
        if (neg) {
          var pool = 'abcdefghijklmnopqrstuvwxyz0123456789';
          var used = {};
          for (var u = 0; u < cs.length; u++) used[cs[u]] = 1;
          var picks = [];
          for (var t = 0; t < pool.length; t++) if (!used[pool[t]]) picks.push(pool[t]);
          return picks.length ? picks[rnd(0, picks.length - 1)] : 'a';
        }
        return cs.length ? cs[rnd(0, cs.length - 1)] : 'a';
      }
      function atom(s, i) {
        var c = s[i];
        if (c === '\\') {
          var n = s[i + 1];
          if (n === 'd') return { s: String(rnd(0, 9)), n: i + 2 };
          if (n === 'D') return { s: String.fromCharCode(65 + rnd(0, 25)), n: i + 2 };
          if (n === 'w') return { s: String.fromCharCode(97 + rnd(0, 25)), n: i + 2 };
          if (n === 'W') return { s: '-', n: i + 2 };
          if (n === 's') return { s: ' ', n: i + 2 };
          if (n === 'S') return { s: 'x', n: i + 2 };
          return { s: n === undefined ? '\\' : n, n: i + 2 };
        }
        if (c === '.') return { s: 'a', n: i + 1 };
        if (c === '[') {
          var e = s.indexOf(']', i + 1);
          if (e === -1) return { s: 'a', n: i + 1 };
          var o = charClass(s.substring(i + 1, e));
          return { s: o, n: e + 1 };
        }
        if (c === '(') {
          var depth = 1, j = i + 1, skip = 0;
          if (s[j] === '?' && s[j + 1] === ':') { skip = 2; j += 2; }
          while (j < s.length && depth) {
            if (s[j] === '(') depth++;
            else if (s[j] === ')') depth--;
            j++;
          }
          var body = s.substring(i + 1 + skip, j - 1);
          var al = splitAlt(body).filter(function (x) { return x; });
          var picked = al.length ? genSeq(al[rnd(0, al.length - 1)]) : genSeq(body);
          return { s: picked, n: j };
        }
        return { s: c, n: i + 1 };
      }
      function genSeq(s) {
        var out = '', pos = 0;
        while (pos < s.length) {
          var c = s[pos];
          if (c === '^' || c === '$') { pos++; continue; }
          var a = atom(s, pos);
          var str = a.s;
          pos = a.n;
          if (pos < s.length) {
            var q = s[pos];
            if (q === '{') {
              var ce = s.indexOf('}', pos);
              if (ce !== -1) {
                var rp = s.substring(pos + 1, ce).split(',');
                var mn = parseInt(rp[0], 10);
                var mx = rp.length > 1 && rp[1] !== '' ? parseInt(rp[1], 10) : mn;
                if (isNaN(mn)) mn = 0;
                if (isNaN(mx)) mx = mn + 4;
                if (mn > mx) { var _t2 = mn; mn = mx; mx = _t2; }
                str = rep(str, rnd(mn, Math.max(mx, mn)));
                pos = ce + 1;
              }
            } else if (q === '*') { str = rep(str, rnd(0, 3)); pos++; }
            else if (q === '+') { str = rep(str, rnd(1, 3)); pos++; }
            else if (q === '?') { if (rnd(0, 1) === 0) str = ''; pos++; }
          }
          out += str;
        }
        return out;
      }
      var tops = splitAlt(p).filter(function (x) { return x; });
      try { return tops.length ? genSeq(tops[rnd(0, tops.length - 1)]) : safe(F.lorem && F.lorem.word)(); }
      catch (e) { return safe(F.lorem && F.lorem.word)(); }
    },

    generate: function (type, opts) {
      opts = opts || {};
      function s(x) { return x !== undefined && x !== null ? String(x) : ''; }
      function cut(x) {
        if (typeof x === 'string' && opts.maxlength > 0 && opts.maxlength < x.length) return Array.from(x).slice(0, opts.maxlength).join('');
        return x;
      }
      function num(min, max, dec) {
        if (isNaN(min) || !isFinite(min)) min = 1;
        if (isNaN(max) || !isFinite(max)) max = 10000;
        if (min > max) { var _t = min; min = max; max = _t; }
        if (dec) { return (F.number && F.number.float ? F.number.float({ min: min, max: max, multipleOf: 0.01 }) : (min + Math.random() * (max - min))).toFixed(2); }
        return String(F.number && F.number.int ? F.number.int({ min: min, max: max }) : Math.floor(min + Math.random() * (max - min + 1)));
      }

      function fmtDate(d, mode) {
        var y = d.getFullYear();
        var mo = d.getMonth() + 1;
        var da = d.getDate();
        var h = d.getHours();
        var mi = d.getMinutes();
        var pad2 = function (n) { return n < 10 ? '0' + n : String(n); };
        if (mode === 'time') return pad2(h) + ':' + pad2(mi);
        if (mode === 'datetimeLocal') return y + '-' + pad2(mo) + '-' + pad2(da) + 'T' + pad2(h) + ':' + pad2(mi);
        if (mode === 'month') return y + '-' + pad2(mo);
        var wk = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7);
        if (mode === 'week') return y + '-W' + (wk < 10 ? '0' : '') + wk;
        return y + '-' + pad2(mo) + '-' + pad2(da);
      }

      function numIn(defMin, defMax) {
        var mn = opts.min !== undefined && opts.min !== '' && opts.min !== null ? Number(opts.min) : defMin;
        var mx = opts.max !== undefined && opts.max !== '' && opts.max !== null ? Number(opts.max) : defMax;
        if (isNaN(mn) || !isFinite(mn)) mn = defMin;
        if (isNaN(mx) || !isFinite(mx)) mx = defMax;
        if (mn > mx) { var t = mn; mn = mx; mx = t; }
        if (mn < 0) mn = 0;
        if (mx < 0) mx = 0;
        return num(mn, mx);
      }

      function run() {
      switch (type) {
        case 'firstName': return cut(s(this.getPersona().firstName));
        case 'lastName': return cut(s(this.getPersona().lastName));
        case 'middleName': return cut(s(safe(F.person && F.person.middleName)()));
        case 'fullName': return cut(s(this.getPersona().fullName));
        case 'prefix': return cut(s(safe(F.person && F.person.prefix)()));
        case 'suffix': return cut(s(safe(F.person && F.person.suffix)()));
        case 'username': return cut(s(this.getPersona().username));
        case 'nickname': return cut(s(safe(F.person && F.person.firstName)().toLowerCase()));
        case 'gender': return cut(s(safe(F.person && F.person.sex)()));
        case 'age': return cut(numIn(18, 80));
        case 'dob':
          var dobD = safe((F.date && F.date.birthdate) || null)({ mode: 'age', min: 18, max: 75 });
          if (!dobD) dobD = new Date(1990, 0, 1);
          return cut(fmtDate(dobD, 'date'));
        case 'nationality': return cut(s(safe(F.location && F.location.country)()));
        case 'email': return cut(s(this.getPersona().email));
        case 'phone':
          if (!opts.pattern && _consistent) return cut(s(personaPhone()));
          return cut(s(generatePhone(opts)));
        case 'mobile':
          if (!opts.pattern && _consistent) return cut(s(personaPhone()));
          return cut(s(generatePhone(opts)));
        case 'timezone': return cut(s(safe(F.location && F.location.timeZone)()));
        case 'streetAddress': return cut(s(personaLock('streetAddress', function () { return s(safe(F.location && F.location.streetAddress)()); })));
        case 'addressLine2': return cut(s(safe(F.location && F.location.secondaryAddress)()));
        case 'apartment':
          var prefixes = ['Apt', 'Suite', 'Unit'];
          return cut(s(prefixes[F.number && F.number.int ? F.number.int({ min: 0, max: 2 }) : 0] + ' ' + num(1, 999)));
        case 'buildingNumber': return cut(s(safe(F.location && F.location.buildingNumber)()));
        case 'city': return cut(s(personaLock('city', function () { return s(safe(F.location && F.location.city)()); })));
        case 'state': return cut(s(personaLock('state', function () { return s(safe(F.location && F.location.state)()); })));
        case 'zip': return cut(s(personaLock('zip', function () { return s(safe(F.location && F.location.zipCode)()); })));
        case 'country': return cut(s(personaLock('country', function () { return s(safe(F.location && F.location.country)()); })));
        case 'countryCode': return cut(s(safe(F.location && F.location.countryCode)()));
        case 'stateCode':
          var sc = '';
          try {
            sc = (F.location && F.location.state) ? F.location.state({ abbreviated: true }) : '';
          } catch (e) {
            // some locales have no abbreviated state data; fall back to the full name
            try { sc = (F.location && F.location.state) ? F.location.state() : ''; } catch (e2) {}
          }
          return cut(s(sc));
        case 'latitude':
          var lat = (F.location && F.location.latitude) ? F.location.latitude() : 0;
          return cut(typeof lat === 'number' ? lat.toFixed(5) : s(lat));
        case 'longitude':
          var lng = (F.location && F.location.longitude) ? F.location.longitude() : 0;
          return cut(typeof lng === 'number' ? lng.toFixed(5) : s(lng));
        case 'coordinates':
          var la2 = (F.location && F.location.latitude) ? F.location.latitude() : 0;
          var lo2 = (F.location && F.location.longitude) ? F.location.longitude() : 0;
          return cut((typeof la2 === 'number' ? la2.toFixed(4) : String(la2)) + ', ' + (typeof lo2 === 'number' ? lo2.toFixed(4) : String(lo2)));
        case 'company': return cut(s(safe(F.company && F.company.name)()));
        case 'companyId': return cut(s('COMP-' + safe(F.string && F.string.numeric)(6)));
        case 'companyWebsite': return cut(s(safe(F.internet && F.internet.url)()));
        case 'department': return cut(s(safe(F.commerce && F.commerce.department)()));
        case 'industry': return cut(s(safe(F.commerce && F.commerce.department)()));
        case 'jobTitle': return cut(s(safe(F.person && F.person.jobTitle)()));
        case 'university':
          var ucity = (F.location && F.location.city) ? F.location.city() : 'Springfield';
          return cut(s(ucity + ' University'));
        case 'degree':
          var degrees = ['Bachelor of Arts', 'Bachelor of Science', 'Bachelor of Engineering', 'Master of Science', 'Master of Business Administration', 'Doctor of Philosophy'];
          return cut(s(degrees[F.number && F.number.int ? F.number.int({ min: 0, max: degrees.length - 1 }) : 0]));
        case 'school':
          var scity = (F.location && F.location.city) ? F.location.city() : 'Springfield';
          return cut(s(scity + ' High School'));
        case 'creditCard': return cut(s(safe(F.finance && F.finance.creditCardNumber)()));
        case 'cvv': return cut(s(safe(F.finance && F.finance.creditCardCVV)()));
        case 'iban': return cut(s(safe(F.finance && F.finance.iban)()));
        case 'swift':
          var bic = (F.finance && F.finance.bic) ? F.finance.bic() : '';
          if (!bic) { var ib = (F.finance && F.finance.iban) ? F.finance.iban() : 'DE89370400440532013000'; bic = ib.substring(0, 8); }
          return cut(s(bic));
        case 'bankAccount': return cut(s(safe(F.finance && F.finance.accountNumber)()));
        case 'currencyCode': return cut(s(safe(F.finance && F.finance.currencyCode)()));
        case 'currency':
          var cur = (F.finance && F.finance.currency) ? F.finance.currency() : null;
          var cname = cur && cur.name ? cur.name : '';
          if (!cname) cname = ((F.location && F.location.country) ? F.location.country() : 'United States') + ' ' + ((F.finance && F.finance.currencyCode) ? F.finance.currencyCode() : 'USD');
          return cut(s(cname));
        case 'price': return cut(s(num(5, 5000, true)));
        case 'amount': return cut(s(num(1, 100000, true)));
        case 'uuid': return cut(s(safe(F.string && F.string.uuid)()));
        case 'userId': return cut(s(safe(F.string && F.string.alphanumeric)(8)));
        case 'orderId': return cut(s('ORD-' + safe(F.string && F.string.numeric)(6)));
        case 'invoiceId': return cut(s('INV-' + safe(F.string && F.string.numeric)(6)));
        case 'productId': return cut(s('PRD-' + safe(F.string && F.string.alphanumeric)(6)));
        case 'otp': return cut(s(safe(F.string && F.string.numeric)(6)));
        case 'pin': return cut(s(safe(F.string && F.string.numeric)(4)));
        case 'securityAnswer': return cut(s(safe(F.lorem && F.lorem.word)()));
        case 'passport':
          var pp = (F.string && F.string.alphanumeric) ? F.string.alphanumeric(9) : 'A12345678';
          return cut(s(pp.toUpperCase()));
        case 'driversLicense':
          var dl = (F.string && F.string.alphanumeric) ? F.string.alphanumeric(10) : 'B123456789';
          return cut(s(dl.toUpperCase()));
        case 'taxId': return cut(s(safe(F.string && F.string.numeric)(9)));
        case 'ssn':
          var sn = (F.string && F.string.numeric) ? F.string.numeric(3) + '-' + F.string.numeric(2) + '-' + F.string.numeric(4) : '123-45-6789';
          return cut(s(sn));
        case 'ip': return cut(s(safe(F.internet && F.internet.ipv4)()));
        case 'ipv6': return cut(s(safe(F.internet && F.internet.ipv6)()));
        case 'mac': return cut(s(safe(F.internet && F.internet.mac)()));
        case 'domain': return cut(s(safe(F.internet && F.internet.domainName)()));
        case 'subdomain': return cut(s(safe(F.internet && F.internet.domainWord)()));
        case 'port': return cut(num(1024, 65535));
        case 'cidr': return cut(s(safe(F.internet && F.internet.ipv4)() + '/24'));
        case 'url': return cut(s(safe(F.internet && F.internet.url)()));
        case 'date':
          var dd = (F.date && F.date.recent) ? F.date.recent({ days: 365 }) : new Date();
          return cut(fmtDate(dd, 'date'));
        case 'time':
          var dt = (F.date && F.date.recent) ? F.date.recent({ days: 1 }) : new Date();
          return cut(fmtDate(dt, 'time'));
        case 'datetimeLocal':
          var dtl = (F.date && F.date.recent) ? F.date.recent({ days: 365 }) : new Date();
          return cut(fmtDate(dtl, 'datetimeLocal'));
        case 'month':
          var ym = F.number && F.number.int ? F.number.int({ min: 2020, max: 2026 }) : 2024;
          var mm = F.number && F.number.int ? F.number.int({ min: 1, max: 12 }) : 6;
          return cut(ym + '-' + (mm < 10 ? '0' : '') + mm);
        case 'week':
          var yw = F.number && F.number.int ? F.number.int({ min: 2020, max: 2026 }) : 2024;
          var ww = F.number && F.number.int ? F.number.int({ min: 1, max: 52 }) : 20;
          return cut(yw + '-W' + (ww < 10 ? '0' : '') + ww);
        case 'year': return cut(String(safe((F.number && F.number.int) || null)({ min: 1950, max: 2025 }) || 1990));
        case 'number':
          var nnMin = (opts.min !== undefined && opts.min !== '' && opts.min !== null) ? Number(opts.min) : 1;
          var nnMax = (opts.max !== undefined && opts.max !== '' && opts.max !== null) ? Number(opts.max) : 10000;
          return cut(num(nnMin, nnMax, opts.step && String(opts.step).indexOf('.') !== -1));
        case 'percentage': return cut(s(safe(F.number && F.number.int)({ min: 0, max: 100 }) + '%'));
        case 'quantity': return cut(numIn(1, 100));
        case 'text':
          if (opts.pattern && /^[A-Za-z0-9\\\s.\-_:]+\{?\d*,?\d*\}?[()\[\]|+*?]*$/.test(opts.pattern) && !/[a-z]{12,}/i.test(opts.pattern)) {
            var rp = RandomData.regexGenerate(opts.pattern);
            if (rp) return cut(s(rp));
          }
          return cut(s(safe(F.lorem && F.lorem.words)(4)));
        case 'paragraph': return cut(s(safe(F.lorem && F.lorem.paragraph)()));
        case 'sentence': return cut(s(safe(F.lorem && F.lorem.sentence)()));
        case 'words': return cut(s(safe(F.lorem && F.lorem.words)(6)));
        case 'bio': return cut(s(safe(F.lorem && F.lorem.paragraphs)(1)));
        case 'slug': return cut(s(safe(F.helpers && F.helpers.slugify)(safe(F.lorem && F.lorem.words)(3))));
        case 'search': return cut(s(safe(F.lorem && F.lorem.words)(2)));
        case 'filename': return cut(s(safe(F.system && F.system.fileName)()));
        case 'fileExt': return cut(s(safe(F.system && F.system.fileExt)()));
        case 'mimeType': return cut(s(safe(F.system && F.system.mimeType)()));
        case 'color': return cut(s(safe(F.color && F.color.human)()));
        case 'hexColor': return cut(s(safe(F.color && F.color.rgb)({ format: 'hex' })));
        case 'boolean': return safe((F.datatype && F.datatype.boolean) || null)();
        case 'password': return cut(s(this.getPassword(opts.settings, false)));
        case 'regex': return cut(s(this.regexGenerate(opts.pattern || (opts.value || ''))));
        case 'template': return cut(s(genTemplate(opts.template || (opts.value || ''))));
        case 'custom':
          var cv = opts.value !== undefined ? String(opts.value) : '';
          return cut(cv);
        default: return cut(s(safe(F.lorem && F.lorem.words)(3)));
      }
      }
      var v = run.call(this);
      if (v === '' && F !== _defF) {
        var _prevF = F; F = _defF;
        _persona = null; _password = null; _confirmPassword = null;
        try { v = run.call(this); } catch (e) {} finally { F = _prevF; }
      }
      return v;
    }
  };

  window.RandomData = RandomData;
  if (typeof module !== 'undefined' && module.exports) module.exports = RandomData;
})();
