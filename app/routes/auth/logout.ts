import { ActionFunctionArgs, redirect } from '@remix-run/node'
import { destroySession, getSession } from '~/utils/sessions'

export async function loader() {
	return redirect('/machines')
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	return redirect('/login', {
		headers: {
			'Set-Cookie': await destroySession(session)
		}
	})
}
