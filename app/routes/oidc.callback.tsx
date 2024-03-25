import { type LoaderFunctionArgs } from '@remix-run/node'

import { finishOidc } from '~/utils/oidc'

export async function loader({ request }: LoaderFunctionArgs) {
	const issuer = process.env.OIDC_ISSUER
	const id = process.env.OIDC_CLIENT_ID
	const secret = process.env.OIDC_CLIENT_SECRET

	if (!issuer || !id || !secret) {
		throw new Error('An invalid OIDC configuration was provided')
	}

	return finishOidc(issuer, id, secret, request)
}
