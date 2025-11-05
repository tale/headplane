import { eq } from 'drizzle-orm';
import { redirect } from 'react-router';
import { users } from '~/server/db/schema';
import type { Route } from './+types/onboarding-skip';

export async function loader({ request, context }: Route.LoaderArgs) {
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
