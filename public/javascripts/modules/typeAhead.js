/* eslint func-names: ["error", "never"] */
/* eslint prefer-destructuring: ["error", {"object": true, "array": false}] */
/* eslint no-console: ["error", { allow: ["warn", "error"] }] */

import axios from 'axios';
import dompurify from 'dompurify'; // strips out everything that contains dangerous HTML and prevents XSS attacks

function searchResultsHTML(stores) {
  return stores.map(store => `<a href="/store/${store.slug}" class="search__result"><strong>${store.name}</strong></a>`).join('');
}

function typeAhead(search) {
  if (!search) return;

  const searchInput = search.querySelector('input[name="search"]');
  const searchResults = search.querySelector('.search__results');

  searchInput.on('input', function () { // bling method, same as addEventListener('input', [...])
    // if there is no value, quit it
    if (!this.value) {
      searchResults.style.display = 'none'; // hide it
      return;
    }

    // show the search results
    searchResults.style.display = 'block';

    axios
      .get(`api/search?q=${this.value}`)
      .then((res) => {
        if (res.data.length) {
          searchResults.innerHTML = dompurify.sanitize(searchResultsHTML(res.data));
        }
        // tell them, nothing came back
        searchResults.innerHTML = dompurify.sanitize(`<div class="search__result">No results for ${this.value} found</div>`);
      })
      .catch((error) => {
        console.error(error);
      });
  });

  // handle keyboard inputs
  searchInput.on('keyup', (e) => {
    // if they aren't pressing up, down or enter, who cares
    if (![38, 40, 13].includes(e.keyCode)) {
      return; // skip it
    }
    const activeClass = 'search__result--active';
    const current = search.querySelector(`.${activeClass}`);
    const items = search.querySelectorAll('.search__result');
    let next;
    if (e.keyCode === 40 && current) {
      // next search result or first one, when at the lower end
      next = current.nextElementSibling || items[0];
    } else if (e.keyCode === 40) {
      next = items[0];
    } else if (e.keyCode === 38 && current) {
      // previous search result or last one, when at the upper end
      next = current.previousElementSibling || items[items.length - 1];
    } else if (e.keyCode === 38) {
      next = items[items.length - 1];
    } else if (e.keyCode === 13 && current.href) {
      window.location = current.href; // direct to store page
      return;
    }
    if (current) {
      current.classList.remove(activeClass);
    }
    next.classList.add(activeClass);
  });
}

export default typeAhead;
