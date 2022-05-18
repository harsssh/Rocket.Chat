import qs from 'query-string';

import type { Serialized } from '../../core-typings/dist';
import type { MatchPathPattern, OperationParams, OperationResult, PathFor } from '../../rest-typings/dist';
import type { Middleware, RestClientInterface } from './RestClientInterface';

export { RestClientInterface };

const pipe =
	<T extends (...args: any[]) => any>(fn: T) =>
	(...args: Parameters<T>): ReturnType<T> =>
		fn(...args);

function buildFormData(data?: Record<string, any> | void, formData = new FormData(), parentKey?: string): FormData {
	if (data instanceof FormData) {
		return data;
	}
	if (!data) {
		return formData;
	}

	if (typeof data === 'object' && !(data instanceof File)) {
		Object.keys(data).forEach((key) => {
			buildFormData(formData, data[key], parentKey ? `${parentKey}[${key}]` : key);
		});
	} else {
		data && parentKey && formData.append(parentKey, data);
	}
	return formData;
}

const checkIfIsFormData = (data: any = {}): boolean => {
	if (data instanceof FormData) {
		return true;
	}
	return Object.values(data).some((value) => {
		if (typeof value === 'object' && !(value instanceof File)) {
			return checkIfIsFormData(value);
		}
		return value instanceof File;
	});
};

export class RestClient implements RestClientInterface {
	private readonly baseUrl: string;

	private headers: Record<string, string> = {};

	private credentials:
		| {
				'X-User-Id': string;
				'X-Auth-Token': string;
		  }
		| undefined;

	constructor({
		baseUrl,
		credentials,
		headers = {},
	}: {
		baseUrl: string;
		credentials?: {
			'X-User-Id': string;
			'X-Auth-Token': string;
		};
		headers?: Record<string, string>;
	}) {
		this.baseUrl = `${baseUrl}/api`;
		this.setCredentials(credentials);
		this.headers = headers;
	}

	getCredentials(): ReturnType<RestClientInterface['getCredentials']> {
		return this.credentials;
	}

	setCredentials: RestClientInterface['setCredentials'] = (credentials) => {
		this.credentials = credentials;
	};

	get<TPath extends PathFor<'GET'>>(
		endpoint: TPath,
		params: void extends OperationParams<'GET', MatchPathPattern<TPath>> ? never : OperationParams<'GET', MatchPathPattern<TPath>>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'GET', MatchPathPattern<TPath>>>>;

	get<TPath extends PathFor<'GET'>>(
		endpoint: TPath,
		params?: void extends OperationParams<'GET', MatchPathPattern<TPath>> ? undefined : never,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'GET', MatchPathPattern<TPath>>>>;

	get<TPath extends PathFor<'GET'>>(
		endpoint: TPath,
		params?: OperationParams<'GET', MatchPathPattern<TPath>>,
		options?: Omit<RequestInit, 'method'>,
	): Promise<Serialized<OperationResult<'GET', MatchPathPattern<TPath>>>> {
		if (/\?/.test(endpoint)) {
			// throw new Error('Endpoint cannot contain query string');
			console.warn('Endpoint cannot contain query string', endpoint);
		}
		const queryParams = this.getParams(params);
		return this.send(`${endpoint}${queryParams ? `?${queryParams}` : ''}`, 'GET', options).then(function (response) {
			return response.json();
		});
	}

	post: RestClientInterface['post'] = (endpoint, params, { headers, ...options } = {}) => {
		const isFormData = checkIfIsFormData(params);

		return this.send(endpoint, 'POST', {
			body: isFormData ? buildFormData(params) : JSON.stringify(params),

			headers: {
				Accept: 'application/json',
				...(!isFormData && { 'Content-Type': 'application/json' }),
				...headers,
			},

			...options,
		}).then(function (response) {
			return response.json();
		});
	};

	put: RestClientInterface['put'] = (endpoint, params, { headers, ...options } = {}) => {
		const isFormData = checkIfIsFormData(params);
		return this.send(endpoint, 'PUT', {
			body: isFormData ? buildFormData(params) : JSON.stringify(params),

			headers: {
				Accept: 'application/json',
				...(!isFormData && { 'Content-Type': 'application/json' }),
				...headers,
			},

			...options,
		}).then(function (response) {
			return response.json();
		});
	};

	delete: RestClientInterface['delete'] = (endpoint, params, options) => {
		return this.send(endpoint, 'DELETE', options).then(function (response) {
			return response.json();
		});
	};

	protected getCredentialsAsHeaders(): Record<string, string> {
		const credentials = this.getCredentials();
		return credentials
			? {
					'X-User-Id': credentials['X-User-Id'],
					'X-Auth-Token': credentials['X-Auth-Token'],
			  }
			: {};
	}

	send(endpoint: string, method: string, { headers, ...options }: Omit<RequestInit, 'method'> = {}): Promise<Response> {
		return fetch(`${this.baseUrl}${`/${endpoint}`.replace(/\/+/, '/')}`, {
			...options,
			headers: { ...this.getCredentialsAsHeaders(), ...this.headers, ...headers },
			method,
		});
	}

	protected getParams(data: Record<string, object | number | string | boolean> | void): string {
		return data ? qs.stringify(data, { arrayFormat: 'bracket' }) : '';
	}

	use(middleware: Middleware<RestClientInterface['send']>): void {
		const fn = this.send.bind(this);
		this.send = function (this: RestClient, ...context: Parameters<RestClientInterface['send']>): ReturnType<RestClientInterface['send']> {
			return middleware(context, pipe(fn));
		} as RestClientInterface['send'];
	}
}
