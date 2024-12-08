import { LoaderFunctionArgs, data } from '@remix-run/node'
import { loadContext } from '~/utils/config/headplane'
import { finishOidc } from '~/utils/oidc'

export async function loader({ request }: LoaderFunctionArgs) {
	try {
		const context = await loadContext()
		if (!context.oidc) {
			throw new Error('An invalid OIDC configuration was provided')
		}

		return finishOidc(context.oidc, request)
	} catch (error) {
		// Gracefully present OIDC errors
		return data({ error }, { status: 500 })
	}
}
