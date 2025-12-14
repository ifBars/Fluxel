# Security Policy

## Supported Versions

Security updates are provided for:

- The latest stable release
- The `main` branch

Older releases may not receive security fixes. If you need a fix backported, open a private report and explain your constraints.

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues, discussions, or pull requests.

Preferred: **Report via GitHub Security Advisories**

- Security page: https://github.com/ifBars/Fluxel/security
- Report form: https://github.com/ifBars/Fluxel/security/advisories/new
- Or go to this repository’s **Security** tab → **Report a vulnerability**

Alternative: **Discord DM**

- DM `ifbars` on Discord

If you’re unsure whether something is a vulnerability, report it anyway and we’ll help triage it.

### What to Include

- A clear description of the issue and impact
- Reproduction steps, proof-of-concept, or exploit scenario (if available)
- Affected versions/commit(s)
- Any relevant logs, screenshots, or crash reports
- Suggested fix or mitigation (if you have one)

## Response Timeline

We aim to:

- Acknowledge receipt within **72 hours**
- Provide an initial assessment within **7 days**

Complex issues may take longer to resolve; we’ll keep you updated as we investigate.

## Disclosure Policy

- Please keep reports private until a fix is released.
- We will coordinate a disclosure date with the reporter when possible.
- If the issue affects downstream users, we may publish a GitHub Security Advisory and release notes describing the impact and mitigation.

## Scope

In scope:

- Vulnerabilities in the Fluxel codebase (`src/`, `src-tauri/`)
- Insecure defaults and configuration issues that affect users by default
- Supply-chain issues introduced by this repository (e.g., malicious scripts/config committed here)

Out of scope (unless there’s clear, practical security impact):

- Denial of service via extreme resource consumption
- Issues requiring physical access to a user’s machine
- Social engineering, phishing, or user education issues
- Vulnerabilities in third-party services or dependencies without a demonstrable impact in Fluxel

## Safe Harbor

We support good-faith security research. If you:

- Make a good-faith effort to avoid privacy violations and disruption
- Only target accounts/data you own or have permission to test
- Avoid destructive actions and do not exfiltrate data beyond what’s necessary to demonstrate impact

…we will not pursue legal action against you for your research.
