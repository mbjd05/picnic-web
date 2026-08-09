- [x] The dropdown in the category selection on the cookbook page cannot be dismissed by clicking outside it.
- [x] The back button in that same location has non-conforming styling (colouring), also do an application wide styling conformity pass comparing the styling of elements that should look the same across different locations and fixing the outliers
- [x] The recipe grid items have bookmark buttons, same as on their detail pages, but these do not have the same correct animation when hovering as their counterparts on the detail pages.
- [x] The colour for the selected indicator in 'zoeken in' on the cookbook page regressed for light mode. It looked better before we added our dark mode, can you restore it's light mode look from commit history?

## Larger tasks:

- [x] We need to make this app a proper pwa, so that could mean a reputable helper package to help us make sure we meet standards for modern pwa's or doing everything ourselves
- [x] The repo does not make clear across documents such as the readme that this is not just another fork but a transition away from next.js and SSR to make hosting and targeting different platforms, such as docker and tauri which we will add later, easier, as well as a revamped ui, dark mode, payment system etc. Check everything we have that upstream does not, and write a little bit about it where it is suitable without bashing on upstream and also crediting and thanking all upstream projects we either took functionality and/or inspiration from.
