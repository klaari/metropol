import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <SignIn />
    </div>
  );
}
