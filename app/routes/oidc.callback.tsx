import { type LoaderFunctionArgs } from '@remix-run/node'

import { loadContext } from '~/utils/config/headplane'
import { finishOidc } from '~/utils/oidc'

export async function loader({ request }: LoaderFunctionArgs) {
	const context = await loadContext()
	if (!context.oidc) {
		throw new Error('An invalid OIDC configuration was provided')
	}

	return finishOidc(
		context.oidc.issuer,
		context.oidc.client,
		context.oidc.secret,
		request,
	)
}
