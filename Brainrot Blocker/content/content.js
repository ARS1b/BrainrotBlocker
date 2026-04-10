// ===== Content Script =====
// Tarkistaa onko nykyinen sivu estolistalla ja näyttää estonäkymän tarvittaessa.

(function () {
	const currentHost = normalizeHost(window.location.hostname);
	let blockedViewRendered = false;

	if (!currentHost) {
		return;
	}

	chrome.storage.local.get(['blockedSites', 'focusMode'], (result) => {
		const blockedSites = Array.isArray(result.blockedSites) ? result.blockedSites : [];
		const isBlocked = shouldBlockCurrentHost(Boolean(result.focusMode), blockedSites, currentHost);

		if (isBlocked) {
			renderBlockedView(currentHost);
			blockedViewRendered = true;
		}
	});

	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== 'local') {
			return;
		}

		const blockedSitesChanged = Boolean(changes.blockedSites);
		const focusModeChanged = Boolean(changes.focusMode);

		if (!blockedSitesChanged && !focusModeChanged) {
			return;
		}

		chrome.storage.local.get(['blockedSites', 'focusMode'], (result) => {
			const nextBlockedSites = Array.isArray(result.blockedSites) ? result.blockedSites : [];
			const isBlocked = shouldBlockCurrentHost(Boolean(result.focusMode), nextBlockedSites, currentHost);

			if (isBlocked) {
				renderBlockedView(currentHost);
				blockedViewRendered = true;
				return;
			}

			if (blockedViewRendered) {
				window.location.reload();
			}
		});
	});
})();

function shouldBlockCurrentHost(isFocusModeOn, blockedSites, currentHost) {
	if (!isFocusModeOn) {
		return false;
	}

	return blockedSites.some((entry) => hostMatches(currentHost, entry));
}

function normalizeHost(host) {
	if (!host || typeof host !== 'string') {
		return null;
	}

	return host.trim().toLowerCase().replace(/^www\./, '');
}

function normalizeInputToHost(input) {
	if (!input || typeof input !== 'string') {
		return null;
	}

	let value = input.trim().toLowerCase();
	if (!value) {
		return null;
	}

	if (!value.startsWith('http://') && !value.startsWith('https://')) {
		value = `https://${value}`;
	}

	try {
		const parsed = new URL(value);
		return normalizeHost(parsed.hostname);
	} catch (_error) {
		return null;
	}
}

function hostMatches(currentHost, blockedEntry) {
	const blockedHost = normalizeInputToHost(blockedEntry);
	if (!blockedHost) {
		return false;
	}

	return currentHost === blockedHost || currentHost.endsWith(`.${blockedHost}`);
}

function renderBlockedView(host) {
	const blockedHtml = `
<!doctype html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>Site Blocked</title>
	<style>
		* { box-sizing: border-box; }
		body {
			margin: 0;
			min-height: 100vh;
			display: grid;
			place-items: center;
			font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
			background: radial-gradient(circle at top, #1f2937 0%, #0b1120 65%);
			color: #e5e7eb;
			padding: 20px;
		}
		.blocked-card {
			width: min(560px, 100%);
			background: rgba(17, 24, 39, 0.86);
			border: 1px solid rgba(239, 68, 68, 0.4);
			border-radius: 16px;
			padding: 24px;
			box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
		}
		.blocked-title {
			margin: 0;
			color: #fca5a5;
			font-size: 28px;
			font-weight: 800;
		}
		.blocked-text {
			margin: 10px 0 18px;
			color: #cbd5e1;
			line-height: 1.5;
		}
		.blocked-host {
			margin: 0;
			padding: 12px;
			border-radius: 10px;
			background: rgba(255, 255, 255, 0.06);
			font-size: 14px;
			color: #f8fafc;
			word-break: break-all;
		}
		.blocked-actions {
			margin-top: 20px;
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
		}
		.blocked-btn {
			border: none;
			border-radius: 10px;
			padding: 10px 14px;
			background: #ef4444;
			color: #fff;
			cursor: pointer;
			font-weight: 700;
		}
		.blocked-btn.secondary {
			background: rgba(255, 255, 255, 0.12);
		}
	</style>
</head>
<body>
	<main class="blocked-card" role="dialog" aria-modal="true" aria-labelledby="blockedTitle">
		<h1 class="blocked-title" id="blockedTitle">Site Blocked</h1>
		<br />
		<p class="blocked-host">${escapeHtml(host)}</p>
		<br />
	</main>
</body>
</html>
`;

	document.documentElement.innerHTML = blockedHtml;
}

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}