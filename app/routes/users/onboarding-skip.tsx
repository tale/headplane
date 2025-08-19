import { eq } from 'drizzle-orm';
import { LoaderFunctionArgs, redirect } from 'react-router';
import { LoadContext } from '~/server';
import { users } from '~/server/db/schema';

export async function loader({
	request,
	context,
}: LoaderFunctionArgs<LoadContext>) {
	try {
		const { user } = await context.sessions.auth(request);
		await context.db
			.update(users)
			.set({
				onboarded: true,
			})
			.where(eq(users.sub, user.subject));

		return redirect('/machines');
	} catch {
		return redirect('/login');
	}
}
