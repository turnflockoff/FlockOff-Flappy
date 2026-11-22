# Decision record: magnetic "leaf" plate cover — not built, not published

**Status:** Not implemented. Not published. Not for sale.

## The concept
A set of leaf-shaped magnetic pieces, sold as "art frames only," that attach to a license plate and sit over one of its characters.

## What was requested
A 3D model, five design variations, an agree-to-terms checkout gate, and a California-specific legal review.

## Why it was not built
- California Vehicle Code §5201(f) prohibits any product or device that obstructs or impairs the reading or recognition of a license plate by law-enforcement or toll equipment. Other states have comparable rules.
- The violation is installing the device on a vehicle. A terms-and-conditions checkbox or an "art only" label does not change what the product does once it is on the plate.
- Because the legal problem is the function itself, no checkout wording could make the product lawful. The work was stopped at the research stage.

## What was built instead
- A street-legal "FLOCK OFF" plate frame that leaves every character, the state name and the registration sticker visible (`docs/storefront/products.html`).
- A catalog tool that refuses listings shaped like a plate-obstruction device (`mcp-servers/shop-catalog`).
- Novelty and honest-claims products: the $9.99 disguise glasses, IR-reflective glasses with accurate limits stated, stickers.

## Evidence
- Statute research: California Vehicle Code §5201 (FindLaw, public.law).
- Guard behavior: the catalog's `add_product` rejected a plate-cover listing in testing (see PR #4 test plan).
