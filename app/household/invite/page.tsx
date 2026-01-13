import InviteMemberClient from "./InviteMemberClient";

/**
 * Invite member page.
 * Authentication is checked on the client side - if the user is not authenticated,
 * they will be redirected to the home page by the InviteMemberClient component.
 */
export default function InviteMemberPage() {
  return <InviteMemberClient />;
}
