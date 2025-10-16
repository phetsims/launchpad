// Copyright 2025, University of Colorado Boulder

/**
 * GitHub APIs for server side
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Octokit } from 'octokit';
import fs from 'fs';
import { config } from './config.js';
import pLimit from 'p-limit';

const githubRequestLimit = pLimit( 10 );

let githubAuth = '';

const buildLocalFile = `${process.env.HOME}/.phet/build-local.json`;
if ( fs.existsSync( buildLocalFile ) ) {
  const buildLocalObject = JSON.parse( fs.readFileSync( buildLocalFile, 'utf8' ) );
  if ( buildLocalObject.developerGithubAccessToken ) {
    githubAuth = buildLocalObject.developerGithubAccessToken;
  }
}

if ( !githubAuth ) {
  githubAuth = config.githubToken || '';
}

if ( !githubAuth.length ) {
  throw new Error( 'GitHub access token not found, please create ~/.phet/build-local.json with phetDevGitHubAccessToken, or specify in config.json githubToken' );
}

const octokit = new Octokit( { auth: githubAuth } );

export const githubGetLatestBranchSHA = async ( owner: string, repo: string, branch: string ): Promise<string> => {
  return githubRequestLimit( async () => {
    if ( repo === 'perennial-alias' ) {
      repo = 'perennial';
    }

    const response = await octokit.request( `GET /repos/${owner}/${repo}/git/ref/heads/${branch}`, {
      owner: owner,
      repo: repo,
      ref: `heads/${branch}` // Specify the branch reference
    } );

    return response.data.object.sha;
  } );
};