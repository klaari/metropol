"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import {
  Button,
  HStack,
  Inline,
  PageSection,
  StatusDot,
  Surface,
  Text,
  VStack,
} from "@/components/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function SettingsPage() {
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const [cookieStatus, setCookieStatus] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${API_URL}/cookies`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: { loaded: boolean } = await r.json();
        setCookieStatus(data.loaded);
      } catch {
        setCookieStatus(false);
      }
    })();
  }, [getToken]);

  async function uploadFile(file: File) {
    setStatusMessage(null);
    setIsError(false);
    setUploading(true);

    const formData = new FormData();
    formData.append("cookies", file);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/cookies`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setStatusMessage((data as { error: string }).error ?? "Upload failed");
      } else {
        setCookieStatus(true);
        setStatusMessage("Cookies uploaded successfully");
      }
    } catch {
      setIsError(true);
      setStatusMessage("Network error — upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <VStack gap="xl" pad="lg" className="max-w-3xl w-full mx-auto">
      <VStack gap="xs">
        <Text variant="eyebrow" tone="muted">
          Configuration
        </Text>
        <Text variant="titleLg">Settings</Text>
      </VStack>

      {user ? (
        <PageSection eyebrow="Account">
          <Surface tone="raised" rounded="lg" pad="none" bordered>
            <HStack gap="md" pad="base" className="border-b border-paper-edge">
              {user.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.imageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
              ) : null}
              <div className="min-w-0">
                <Text variant="bodyStrong" numberOfLines={1}>
                  {user.fullName ?? user.username ?? "Account"}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {user.primaryEmailAddress?.emailAddress}
                </Text>
              </div>
            </HStack>
            <button
              onClick={() => signOut()}
              className="w-full text-left px-base py-md hover:bg-paper-sunken transition-colors"
            >
              <Text variant="bodyStrong" tone="critical">
                Sign out
              </Text>
            </button>
          </Surface>
        </PageSection>
      ) : null}

      <PageSection eyebrow="YouTube" title="Cookies">
        <Surface tone="raised" rounded="lg" pad="lg" bordered>
          <VStack gap="base">
            <Text variant="body" tone="muted">
              Upload a cookies.txt file from your browser to authenticate
              YouTube downloads. Use a browser extension like &ldquo;Get
              cookies.txt LOCALLY&rdquo; to export them.
            </Text>

            <Inline>
              <Text variant="body" tone="muted">
                Status
              </Text>
              <HStack gap="sm" align="center">
                {cookieStatus === null ? (
                  <>
                    <StatusDot tone="muted" />
                    <Text variant="bodyStrong" tone="muted">
                      Checking…
                    </Text>
                  </>
                ) : cookieStatus ? (
                  <>
                    <StatusDot tone="positive" />
                    <Text variant="bodyStrong" tone="positive">
                      Cookies loaded
                    </Text>
                  </>
                ) : (
                  <>
                    <StatusDot tone="warning" />
                    <Text variant="bodyStrong" tone="warning">
                      Not loaded
                    </Text>
                  </>
                )}
              </HStack>
            </Inline>

            <Button
              label={uploading ? "Uploading…" : "Upload cookies.txt"}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
            />

            {statusMessage ? (
              <Text
                variant="caption"
                tone={isError ? "critical" : "positive"}
              >
                {statusMessage}
              </Text>
            ) : null}

            <Text variant="caption" tone="faint">
              Needed to download YouTube content. Export from your browser
              using &ldquo;Get cookies.txt LOCALLY&rdquo; (Chrome) or Cookie
              Quick Manager (Firefox). Use an incognito window for
              longer-lasting cookies.
            </Text>
          </VStack>
        </Surface>
      </PageSection>
    </VStack>
  );
}
