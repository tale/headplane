import Card from '~/components/Card';

export default function Logout() {
	return (
		<div className="flex w-screen h-screen items-center justify-center">
			<Card className="max-w-md m-4 sm:m-0">
				<Card.Title>You have been logged out</Card.Title>
				<Card.Text>
					You can now close this window. If you would like to log in again,
					please refresh the page.
				</Card.Text>
			</Card>
		</div>
	);
}
