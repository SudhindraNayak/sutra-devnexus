import { v4 as uuidv4 } from 'uuid';
import { log } from './logger';

function detectFormat(json) {
  if (json && json.info && typeof json.info.schema === 'string') {
    if (json.info.schema.includes('v2.1')) return 'collection-v2.1';
    if (json.info.schema.includes('v2.0')) return 'collection-v2.0';
  }
  if (json && Array.isArray(json.values)) return 'environment';
  throw new Error(
    'Unrecognized format. Expected a Postman Collection v2.0/v2.1 or Environment export.'
  );
}

function parseAuth(authObj) {
  if (!authObj || !authObj.type) return { type: 'none' };
  const type = authObj.type;
  const findVal = (arr, key) => (arr || []).find((b) => b.key === key)?.value || '';

  if (type === 'bearer') {
    return { type: 'bearer', bearer: { token: findVal(authObj.bearer, 'token') } };
  }
  if (type === 'basic') {
    return {
      type: 'basic',
      basic: { username: findVal(authObj.basic, 'username'), password: findVal(authObj.basic, 'password') },
    };
  }
  if (type === 'apikey') {
    return {
      type: 'apikey',
      apikey: {
        key:   findVal(authObj.apikey, 'key'),
        value: findVal(authObj.apikey, 'value'),
        in:    findVal(authObj.apikey, 'in') || 'header',
      },
    };
  }
  if (type === 'oauth2') {
    const getV = (key) => findVal(authObj.oauth2, key);
    return {
      type: 'oauth2',
      oauth2: {
        grantType:   getV('grant_type') || 'client_credentials',
        authUrl:     getV('authUrl') || getV('auth_url') || '',
        tokenUrl:    getV('accessTokenUrl') || getV('token_url') || '',
        clientId:    getV('clientId') || '',
        clientSecret:getV('clientSecret') || '',
        scope:       getV('scope') || '',
        redirectUri: getV('redirect_uri') || getV('redirectUri') || '',
        tokenName:   getV('tokenName') || 'Imported Token',
        currentToken: null,
      },
    };
  }
  if (type === 'awsv4') {
    return {
      type: 'awssigv4',
      awssigv4: {
        accessKey:    findVal(authObj.awsv4, 'accessKey'),
        secretKey:    findVal(authObj.awsv4, 'secretKey'),
        region:       findVal(authObj.awsv4, 'region') || 'us-east-1',
        service:      findVal(authObj.awsv4, 'service') || '',
        sessionToken: findVal(authObj.awsv4, 'sessionToken') || '',
      },
    };
  }
  if (type === 'hawk') {
    return {
      type: 'hawk',
      hawk: {
        hawkId:    findVal(authObj.hawk, 'authId'),
        hawkKey:   findVal(authObj.hawk, 'authKey'),
        algorithm: findVal(authObj.hawk, 'algorithm') || 'sha256',
      },
    };
  }
  if (type === 'digest') {
    return {
      type: 'digest',
      digest: {
        username:  findVal(authObj.digest, 'username'),
        password:  findVal(authObj.digest, 'password'),
        realm:     '',
        nonce:     '',
        algorithm: 'MD5',
      },
    };
  }
  if (type === 'ntlm') {
    return {
      type: 'ntlm',
      ntlm: {
        username:    findVal(authObj.ntlm, 'username'),
        password:    findVal(authObj.ntlm, 'password'),
        domain:      findVal(authObj.ntlm, 'domain') || '',
        workstation: findVal(authObj.ntlm, 'workstation') || '',
      },
    };
  }
  if (type === 'edgegrid') {
    return {
      type: 'edgegrid',
      edgegrid: {
        clientToken:  findVal(authObj.edgegrid, 'clientToken'),
        clientSecret: findVal(authObj.edgegrid, 'clientSecret'),
        accessToken:  findVal(authObj.edgegrid, 'accessToken'),
        baseUri:      findVal(authObj.edgegrid, 'baseUri') || '',
      },
    };
  }
  return { type: 'none' };
}

function parseRequest(item) {
  const req = item.request || {};
  const rawUrl = typeof req.url === 'string' ? req.url : req.url?.raw || '';

  const headers = (req.header || []).map((h) => ({
    id: uuidv4(), key: h.key || '', value: h.value || '', enabled: !h.disabled,
  }));

  let body = { type: 'none', content: '', fields: [] };
  if (req.body) {
    const mode = req.body.mode;
    if (mode === 'raw') {
      const lang = req.body.options?.raw?.language;
      body = { type: lang === 'json' ? 'json' : 'raw', content: req.body.raw || '', fields: [] };
    } else if (mode === 'formdata') {
      body = { type: 'form', content: '', fields: (req.body.formdata || []).map((f) => ({ id: uuidv4(), key: f.key || '', value: f.value || '', enabled: !f.disabled })) };
    } else if (mode === 'urlencoded') {
      body = { type: 'form', content: '', fields: (req.body.urlencoded || []).map((f) => ({ id: uuidv4(), key: f.key || '', value: f.value || '', enabled: !f.disabled })) };
    }
  }

  const params = (req.url?.query || []).map((q) => ({
    id: uuidv4(), key: q.key || '', value: q.value || '', enabled: !q.disabled,
  }));

  return {
    id:      uuidv4(),
    name:    item.name || 'Untitled Request',
    method:  (req.method || 'GET').toUpperCase(),
    url:     rawUrl,
    params,
    headers,
    body,
    auth:    parseAuth(req.auth),
  };
}

function parseItems(items = []) {
  const requests = [];
  for (const item of items) {
    if (Array.isArray(item.item)) {
      requests.push(...parseItems(item.item));
    } else if (item.request) {
      requests.push(parseRequest(item));
    }
  }
  return requests;
}

function parseCollection(json) {
  const name     = json.info?.name || 'Imported Collection';
  const requests = parseItems(json.item || []);
  return { id: uuidv4(), name, requests };
}

function parseEnvironment(json) {
  const name      = json.name || 'Imported Environment';
  const variables = (json.values || []).map((v) => ({
    key: v.key || '', value: v.value || '', enabled: v.enabled !== false,
  }));
  return { id: uuidv4(), name, variables };
}

export function importPostman(json) {
  const format = detectFormat(json);

  if (format === 'collection-v2.0' || format === 'collection-v2.1') {
    const collection = parseCollection(json);
    log('info', 'Postman Import', `Imported collection "${collection.name}" (${collection.requests.length} requests, format: ${format})`);
    return { type: 'collection', format, collection, requestCount: collection.requests.length };
  }

  if (format === 'environment') {
    const environment = parseEnvironment(json);
    log('info', 'Postman Import', `Imported environment "${environment.name}" (${environment.variables.length} variables)`);
    return { type: 'environment', format, environment, variableCount: environment.variables.length };
  }
}

export function parsePostmanFile(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const msg = 'Invalid JSON: the file could not be parsed.';
    log('error', 'Postman Import', msg);
    throw new Error(msg);
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    const msg = 'Invalid file: expected a JSON object.';
    log('error', 'Postman Import', msg);
    throw new Error(msg);
  }
  try {
    return importPostman(json);
  } catch (err) {
    log('error', 'Postman Import', err.message);
    throw err;
  }
}
