import { type ActionFunctionArgs, redirect } from '@remix-run/node'

import { destroySession, getSession } from '~/utils/sessions'

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	const returnTo = new URL(request.url).pathname

	return redirect(`/login?returnTo=${returnTo}`, {
		headers: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Set-Cookie': await destroySession(session)
		}
	})
}
