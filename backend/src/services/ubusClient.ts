export interface AccessPointConfig {
  host: string;
  ubusUrl?: string;
  username: string;
  password: string;
  useHttps?: boolean;
}

export interface UbusCallResult {
  code: number;
  data?: unknown;
}

export class UbusError extends Error {
  constructor(
    message: string,
    public readonly code?: number
  ) {
    super(message);
    this.name = 'UbusError';
  }
}

const ANONYMOUS_SESSION = '00000000000000000000000000000000';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: 'call';
  params: [string, string, string, Record<string, unknown>?];
}

interface JsonRpcResponse {
  id: number;
  result?: [number, unknown];
  error?: { code: number; message: string };
}

export class UbusClient {
  private session: string | null = null;

  constructor(private readonly config: AccessPointConfig) {}

  private get baseUrl(): string {
    const scheme = this.config.useHttps ? 'https' : 'http';
    const path = this.config.ubusUrl || '/ubus';
    return `${scheme}://${this.config.host}${path}`;
  }

  async login(): Promise<string> {
    const result = await this.callRaw(
      ANONYMOUS_SESSION,
      'session',
      'login',
      {
        username: this.config.username,
        password: this.config.password,
      }
    );

    const data = result.data as { ubus_rpc_session?: string } | undefined;
    if (!data?.ubus_rpc_session) {
      throw new UbusError('Login failed: no session token returned');
    }

    this.session = data.ubus_rpc_session;
    return this.session;
  }

  private async ensureSession(): Promise<string> {
    if (!this.session) {
      return this.login();
    }
    return this.session;
  }

  async call(
    object: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<UbusCallResult> {
    const session = await this.ensureSession();
    return this.callRaw(session, object, method, params);
  }

  private async callRaw(
    session: string,
    object: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<UbusCallResult> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'call',
      params: [session, object, method, params],
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new UbusError(`HTTP ${response.status} from ${this.config.host}`);
    }

    const body = (await response.json()) as JsonRpcResponse;
    if (body.error) {
      throw new UbusError(body.error.message, body.error.code);
    }

    if (!body.result) {
      throw new UbusError('Empty ubus response');
    }

    const [code, data] = body.result;
    if (code !== 0) {
      throw new UbusError(`ubus call failed with code ${code}`, code);
    }

    return { code, data };
  }
}

export function createUbusClient(config: AccessPointConfig): UbusClient {
  return new UbusClient(config);
}
