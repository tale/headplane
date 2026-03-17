import Card from "~/components/card";

export default function Logout() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Card className="m-4 max-w-md sm:m-0">
        <Card.Title>You have been logged out</Card.Title>
        <Card.Text>
          You can now close this window. If you would like to log in again, please refresh the page.
        </Card.Text>
      </Card>
    </div>
  );
}
