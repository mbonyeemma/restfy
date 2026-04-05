# Restify and open source

This document explains how Restify is licensed, why it is open, and what that means for you.

## MIT License

Restify is released under the [MIT License](../LICENSE). In short:

- You may **use**, **copy**, **modify**, **merge**, **publish**, **distribute**, **sublicense**, and **sell** copies of the software.
- The only requirement is that the **copyright notice and license text** stay with copies of the software.
- The software is provided **as-is**, without warranty.

This is one of the most permissive widely used open-source licenses. It keeps friction low for individuals, startups, and enterprises.

## No lock-in by design

The app is meant to be **useful without signing up** for our services. Core workflows (collections, environments, requests) work **offline** in the desktop build and in the browser with **local storage**. Optional cloud features talk to an API you can **self-host** (see `server/`).

We do **not** add hidden telemetry in the spirit of “trust the user’s machine.” If that ever changes for a specific build channel, it would be called out explicitly in release notes—not buried in a policy page.

## Forking and products

You may **fork** this repository and ship your own product, free or commercial, under the terms of the MIT License. A fork does not need our permission. Attribution of the original license file is still required when you redistribute source or binaries derived from this code.

If you publish a derivative, consider stating clearly that it is **not** the official Restify distribution so users are not confused.

## Contributing

Improvements from the community are welcome. See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to propose changes and open pull requests.

## Trademarks

The **Restify** name and any logos you associate with this project are separate from the MIT license on the *code*. If you fork, pick a distinct name for your product unless you have explicit permission to use the same branding.

## Questions

For license interpretation in edge cases (e.g. combining with GPL code), consult your own counsel; this file is **not** legal advice.
