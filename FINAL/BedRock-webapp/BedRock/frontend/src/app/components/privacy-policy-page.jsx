import { Box, Container, Typography } from "@mui/material";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Navbar } from "@/app/components/navbar";
import { brandColors, fontTokens } from "@/theme";

const BODY_COLOR = "rgba(244,238,255,0.72)";
const RULE_COLOR = "rgba(255,255,255,0.07)";
const EASE = [0.16, 1, 0.3, 1];
const LEGAL_MAX_WIDTH = 740;

function FadeUp({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function ArticleHeading({ number, title }) {
  return (
    <Box sx={{ display: "flex", gap: 2, alignItems: "baseline", mb: 2, mt: { xs: 5, md: 6 } }}>
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "rgba(103,80,164,0.5)",
          fontFamily: fontTokens.mono,
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        {number}.
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: "1.25rem", md: "1.5rem" },
          fontWeight: 600,
          color: brandColors.offWhite,
          letterSpacing: "-0.02em",
          lineHeight: 1.3,
          fontFamily: fontTokens.ui,
        }}
      >
        {title}
      </Typography>
    </Box>
  );
}

function Paragraph({ children, indent = false }) {
  return (
    <Typography
      sx={{
        fontSize: "0.9375rem",
        color: BODY_COLOR,
        lineHeight: 1.85,
        fontFamily: fontTokens.body,
        maxWidth: LEGAL_MAX_WIDTH,
        mb: 2,
        pl: indent ? 3 : 0,
      }}
    >
      {children}
    </Typography>
  );
}

function SubClause({ marker, children }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, pl: 1.5, mb: 1.5 }}>
      <Typography
        sx={{
          fontSize: "0.9375rem",
          color: "rgba(139,120,193,0.6)",
          fontFamily: fontTokens.mono,
          lineHeight: 1.85,
          flexShrink: 0,
          minWidth: 28,
        }}
      >
        {marker}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.9375rem",
          color: BODY_COLOR,
          lineHeight: 1.85,
          fontFamily: fontTokens.body,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function BulletItem({ children }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, pl: 1.5, mb: 1 }}>
      <Typography
        sx={{
          fontSize: "0.9375rem",
          color: "rgba(139,120,193,0.5)",
          lineHeight: 1.85,
          flexShrink: 0,
        }}
      >
        {"\u2022"}
      </Typography>
      <Typography
        sx={{
          fontSize: "0.9375rem",
          color: BODY_COLOR,
          lineHeight: 1.85,
          fontFamily: fontTokens.body,
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

export function PrivacyPolicyPage({ onLogoClick, onNavClick, currentScreen }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: brandColors.appBg, color: brandColors.offWhite }}>
      <Navbar onLogoClick={onLogoClick} onNavClick={onNavClick} currentScreen={currentScreen} />

      {/* ── Hero ── */}
      <Box
        sx={{
          pt: { xs: "120px", md: "140px" },
          pb: { xs: 6, md: 8 },
          borderBottom: `1px solid ${RULE_COLOR}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "400px",
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(103,80,164,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <FadeUp>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(139,120,193,0.5)",
                mb: 2,
                fontFamily: fontTokens.ui,
              }}
            >
              Legal
            </Typography>
            <Typography
              sx={{
                fontFamily: fontTokens.ui,
                color: brandColors.offWhite,
                fontWeight: 600,
                fontSize: { xs: "2.5rem", md: "3.5rem" },
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
                mb: 2,
              }}
            >
              Privacy Policy
            </Typography>
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "rgba(244,238,255,0.35)",
                fontFamily: fontTokens.mono,
                letterSpacing: "0.02em",
              }}
            >
              Last updated: 28 March 2026
            </Typography>
          </FadeUp>
        </Container>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Box sx={{ maxWidth: LEGAL_MAX_WIDTH, mx: "auto" }}>
            <FadeUp>
              <Paragraph>
                This Privacy Policy outlines the responsibilities of Bedrock
                ({"\u201c"}Bedrock{"\u201d"}, {"\u201c"}we{"\u201d"}, {"\u201c"}our{"\u201d"},{" "}
                {"\u201c"}us{"\u201d"}) in relation to the collection, processing, use, and
                disclosure of your Personal Data. It explains how we manage Personal Data when you
                use our application or contact us through our Services (collectively, the{" "}
                {"\u201c"}Services{"\u201d"}).
              </Paragraph>
              <Paragraph>
                We are committed to complying with the Personal Data Protection Act 2012 (PDPA) of
                Singapore. This Policy should be read alongside any other terms and conditions
                governing your use of our Services.
              </Paragraph>
            </FadeUp>

            {/* Section 1 */}
            <FadeUp>
              <ArticleHeading number="1" title="Personal Data We Collect and Process" />
              <Paragraph>
                Bedrock does not collect Personal Data through the application itself. Video and
                audio content captured through the application is processed locally in your browser,
                held temporarily in cache for the duration of the session, and cleared once the
                cryptographic hash is generated. This content is never transmitted to or stored on
                Bedrock{"\u2019"}s servers.
              </Paragraph>
              <Paragraph>
                While such content may contain biometric characteristics such as facial features or
                voice, Bedrock does not process it for identification purposes and has no means of
                linking it to a named individual in the ordinary course of its operations.
              </Paragraph>
              <Paragraph>
                Cryptographic hashes and smart contract references derived from captured content are
                written to STABILITY{"\u2019"}s public blockchain and may remain publicly visible
                indefinitely. These are non-reversible digital fingerprints that cannot be used to
                reconstruct the original content or identify any individual, and do not constitute
                Personal Data.
              </Paragraph>
              <Paragraph>
                The only Personal Data Bedrock collects is what you voluntarily submit through our
                contact form, which may include your name, email address, and message content.
              </Paragraph>
            </FadeUp>

            {/* Section 2 */}
            <FadeUp>
              <ArticleHeading
                number="2"
                title="Purpose for Collection, Processing, Use and Disclosure"
              />
              <Paragraph>
                To the extent any data processed through the Services constitutes Personal Data, we
                process it only for the following purposes:
              </Paragraph>
              <SubClause marker="(a)">
                to respond to enquiries submitted through our contact form;
              </SubClause>
              <SubClause marker="(b)">
                to generate cryptographic hashes, timestamps, and related integrity metadata for the
                purpose of anchoring evidence records to the blockchain;
              </SubClause>
              <SubClause marker="(c)">
                to process files uploaded for verification by re-hashing and comparing them against
                on-chain records;
              </SubClause>
              <SubClause marker="(d)">
                to verify the liveness of a user in connection with an evidence capture session, and
                to associate the resulting outcome with the relevant technical records;
              </SubClause>
              <SubClause marker="(e)">
                to maintain limited operational data (such as queue and deployment metadata)
                necessary for the functioning of the Services; and
              </SubClause>
              <SubClause marker="(f)">
                to comply with applicable laws, regulations, and requirements of any regulatory
                authority in Singapore.
              </SubClause>

              <Paragraph>
                Bedrock does not sell, rent, or share your Personal Data with third parties for their
                own commercial purposes. Access to Personal Data is limited to persons whom we
                reasonably believe require access for the effective delivery of our Services or for
                the purposes set out herein.
              </Paragraph>
              <Paragraph>
                We may collect, use, and disclose Personal Data where authorised or required by law,
                or where directed by a relevant regulatory authority or court in Singapore.
              </Paragraph>
              <Paragraph>
                We may disclose or share your Personal Data in the following circumstances:
              </Paragraph>

              <SubClause marker="(a)">
                <strong>Third-Party Service Providers:</strong> We may disclose your Personal Data to
                third parties contracted to assist us in delivering part or all of our Services,
                including infrastructure, identity verification, and technical support providers.
                Such parties act on our instructions and are required to handle Personal Data in a
                manner consistent with this Policy.
              </SubClause>
              <SubClause marker="(b)">
                <strong>With Your Consent:</strong> We may seek your consent to collect, use, or
                disclose your Personal Data for any purpose not set out herein.
              </SubClause>
              <SubClause marker="(c)">
                <strong>Business Transfers:</strong> In the event that Bedrock undergoes a merger,
                acquisition, or transfer of assets, Personal Data held by us may form part of the
                transferred assets. We will notify affected users where required by applicable law.
              </SubClause>

              <Paragraph>
                Bedrock shall use its best endeavours to ensure that its employees, officers, and
                third-party service providers involved in the collection, processing, and disclosure
                of Personal Data observe and adhere to the terms of this Policy and applicable data
                protection obligations under the PDPA.
              </Paragraph>
            </FadeUp>

            {/* Section 3 */}
            <FadeUp>
              <ArticleHeading number="3" title="Security" />
              <Paragraph>
                We take reasonable and appropriate technical and organisational measures to protect
                Personal Data against unauthorised access, disclosure, modification, or destruction,
                in accordance with the PDPA{"\u2019"}s protection obligation under section 24.
              </Paragraph>
              <Paragraph>
                These measures include encrypted data transmission, server memory handling for
                verification uploads (with no persistent storage), and access controls limiting
                exposure of contact form data to authorised personnel only.
              </Paragraph>
            </FadeUp>

            {/* Section 4 */}
            <FadeUp>
              <ArticleHeading number="4" title="Data Retention" />
              <Paragraph>
                In accordance with the PDPA{"\u2019"}s retention limitation obligation under section
                25, we retain Personal Data only for as long as is necessary to fulfil the purpose
                for which it was collected.
              </Paragraph>
              <Paragraph>
                Files uploaded for verification are processed in server memory and deleted promptly
                upon completion of the verification request. They are not retained as long-term
                storage.
              </Paragraph>
              <Paragraph>
                Anchored hashes and smart contract references written to the public blockchain are
                permanent by nature and cannot be removed. As noted above, no raw Personal Data or
                media content is written to the blockchain.
              </Paragraph>
              <Paragraph>
                Contact form submissions are retained only for the duration necessary to address your
                enquiry and deleted within 30 days of resolution, or earlier upon request.
              </Paragraph>
            </FadeUp>

            {/* Section 5 */}
            <FadeUp>
              <ArticleHeading number="5" title="Access and Correction" />
              <Paragraph>
                Under sections 21 and 22 of the PDPA, you have the right to:
              </Paragraph>
              <BulletItem>
                request access to Personal Data we hold about you;
              </BulletItem>
              <BulletItem>
                request correction of any inaccurate or incomplete Personal Data; and
              </BulletItem>
              <BulletItem>
                withdraw consent to the collection, use, or disclosure of your Personal Data,
                subject to any legal or contractual restrictions.
              </BulletItem>
              <Paragraph>
                Please note that data anchored to the public blockchain cannot be modified or deleted
                due to its immutable nature. Any such data consists of cryptographic hashes only and
                does not constitute raw Personal Data.
              </Paragraph>
              <Paragraph>
                To exercise any of these rights, please contact our DPO at the details in section 8
                below. We will respond within 30 days. Where a response cannot be provided within
                that period, we will notify you of the extended timeline in writing.
              </Paragraph>
            </FadeUp>

            {/* Section 6 */}
            <FadeUp>
              <ArticleHeading number="6" title="Accuracy" />
              <Paragraph>
                Bedrock encourages you to ensure that any Personal Data you submit to us, including
                through our contact form, is accurate and complete. If your information changes, or
                if you believe we hold inaccurate Personal Data about you, please contact our DPO
                using the details in section 8 so that we may update our records accordingly.
              </Paragraph>
            </FadeUp>

            {/* Section 7 */}
            <FadeUp>
              <ArticleHeading number="7" title="Limitation of Liability" />
              <Paragraph>
                To the fullest extent permitted by applicable law, Bedrock shall not be liable for
                any loss, damage, or claim arising from a third party{"\u2019"}s failure to comply
                with this Policy or applicable data protection laws, including where such failure
                results from that party providing inaccurate, incomplete, or misleading Personal
                Data, or from unauthorised use of our Services by that party.
              </Paragraph>
              <Paragraph>
                Where a data breach or unauthorised disclosure arises from circumstances beyond
                Bedrock{"\u2019"}s reasonable control, and Bedrock has taken reasonable measures to
                comply with its obligations under the PDPA, Bedrock{"\u2019"}s liability shall be
                limited to the extent permitted by law.
              </Paragraph>
              <Paragraph>
                Nothing in this clause limits Bedrock{"\u2019"}s obligations under the PDPA or
                excludes liability that cannot be excluded by law.
              </Paragraph>
            </FadeUp>

            {/* Section 8 */}
            <FadeUp>
              <ArticleHeading number="8" title="Contact" />
              <Paragraph>
                For enquiries regarding your Personal Data, including requests to access, correct,
                update, or withdraw your data, or to raise a complaint about how it is managed,
                please contact our Data Protection Officer (DPO) at:{" "}
                <Box
                  component="span"
                  sx={{ color: brandColors.offWhite, fontWeight: 500 }}
                >
                  bedrock@gmail.com
                </Box>
              </Paragraph>
            </FadeUp>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
