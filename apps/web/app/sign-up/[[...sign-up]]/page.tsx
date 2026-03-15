import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex justify-center items-center min-h-[70vh]">
      <SignUp />
    </div>
  );
}
