<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- The platform root domain for project subdomains is admin-managed in the platform_domains table (one is_active row); code reads it via getActiveRootDomainFromDb/useRootDomain, and ROOT_DOMAIN is only the fallback — so the domain can change without code edits.
