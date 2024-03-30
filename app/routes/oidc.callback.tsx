import { type LoaderFunctionArgs } from '@remix-run/node'

import { getContext } from '~/utils/config'
import { finishOidc } from '~/utils/oidc'

export async function loader({ request }: LoaderFunctionArgs) {
	const context = await getContext()
	const oidc = context.oidcConfig

	if (!oidc) {
		throw new Error('An invalid OIDC configuration was provided')
	}

	return finishOidc(oidc.issuer, oidc.client, oidc.secret, request)
}
