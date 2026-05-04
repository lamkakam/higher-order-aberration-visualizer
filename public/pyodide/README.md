# Pyodide wheels

This directory intentionally includes `prysm-0.21.1-py2.py3-none-any.whl`.

Pyodide's `micropip` can install only wheels, not source distributions. PyPI
publishes `prysm` 0.21.1 only as a source archive, and the piwheels-hosted wheel
is not reliable when loaded directly from the browser because external hosts can
return redirects, HTML error pages, or responses blocked by browser policy.

Serving the wheel from this app's `public/pyodide` directory gives `micropip` a
same-origin, stable wheel URL. Other generated wheels in this directory should
remain ignored unless there is a specific runtime reason to commit them.
