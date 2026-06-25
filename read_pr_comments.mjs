import fs from "fs/promises";

async function readPrComments() {
    try {
        const response = await fetch(`https://api.github.com/repos/swarmvaultai/swarmvault-opensource/pulls?state=open`, {
            headers: {
                'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const pulls = await response.json();

        if (pulls.length > 0) {
            const pr = pulls.find(p => p.head.ref.includes("devops/stabilize-staging") || p.head.ref.includes("jules-"));
            if (pr) {
                const prNumber = pr.number;
                const commentsResponse = await fetch(`https://api.github.com/repos/swarmvaultai/swarmvault-opensource/issues/${prNumber}/comments`, {
                    headers: {
                        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                const comments = await commentsResponse.json();
                comments.forEach(c => console.log(`${c.user.login}: ${c.body}`));
            } else {
                console.log("PR not found among open PRs");
            }
        } else {
            console.log("No open PRs found.");
        }
    } catch (error) {
        console.error("Error reading PR comments:", error);
    }
}

readPrComments();
