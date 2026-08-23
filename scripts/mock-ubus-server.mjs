/**
 * Minimal ubus JSON-RPC mock for local integration testing.
 * Implements session.login, uci get/set/commit/reload_config, file read/write, rc restart.
 */
import http from 'http';

const PORT = Number(process.env.MOCK_UBUS_PORT || 8080);
const USER = process.env.MOCK_UBUS_USER || 'wifi-control';
const PASS = process.env.MOCK_UBUS_PASS || 'testpass123';

const wireless = {
  wifinet0: {
    '.type': 'wifi-iface',
    '.name': 'wifinet0',
    device: 'radio0',
    mode: 'ap',
    ssid: 'TestNet',
    disabled: '0',
  },
  wifinet1: {
    '.type': 'wifi-iface',
    '.name': 'wifinet1',
    device: 'radio1',
    mode: 'ap',
    ssid: 'GuestNet',
    disabled: '1',
  },
};

let crontab = '';
const sessions = new Map();

function ok(data) {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, result: [0, data] });
}

function fail(message) {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32000, message },
  });
}

function handleCall(session, object, method, params) {
  if (object === 'session' && method === 'login') {
    if (params.username === USER && params.password === PASS) {
      const token = 'mocksession00000000000000000001';
      sessions.set(token, true);
      return { ubus_rpc_session: token };
    }
    return fail('Invalid credentials');
  }

  if (!sessions.has(session)) {
    throw new Error('Access denied');
  }

  if (object === 'uci') {
    if (method === 'get') {
      if (params.config !== 'wireless') throw new Error('config not allowed');
      if (params.section) {
        return { values: wireless[params.section] ?? {} };
      }
      return { values: wireless };
    }
    if (method === 'set') {
      wireless[params.section] = {
        ...wireless[params.section],
        ...params.values,
      };
      return null;
    }
    if (method === 'commit' || method === 'reload_config') {
      return null;
    }
  }

  if (object === 'file') {
    if (method === 'read') {
      return { data: crontab };
    }
    if (method === 'write') {
      crontab = String(params.data ?? '');
      return null;
    }
  }

  if (object === 'rc' && method === 'restart') {
    return null;
  }

  if (object === 'service' && method === 'event') {
    return null;
  }

  throw new Error(`Unsupported ${object}.${method}`);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/ubus') {
    res.writeHead(404);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const [session, object, method, params = {}] = payload.params ?? [];
      const result = handleCall(session, object, method, params);
      if (typeof result === 'string') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(result);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(ok(result));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        fail(error instanceof Error ? error.message : 'request failed')
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mock ubus listening on http://127.0.0.1:${PORT}/ubus`);
  console.log(`Login: ${USER} / ${PASS}`);
});
