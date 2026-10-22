// What to read next, the citing ask and Ko-fi, and the Method notes: where
// the games come from and the rulings the words rest on, in folded sections
// (a reader opens the one they came to argue about; a crawler reads them all).
import { track } from '../lib/analytics.ts'
import { seasonWords } from '../lib/ledger.ts'

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom'

export function Notes({ ledger }) {
  const first = seasonWords(ledger.firstSeason)
  const espn = seasonWords(ledger.startsSince)
  return (
    <>
      <h2 className="notes-h">What to read next</h2>
      <div className="notes">
        <p>
          <a href="https://drewhoover.com/nfl-comparator/">NFL Comparator</a> — the same comparator over every NFL
          career since 1999, with a page for every player and what he leads.
        </p>
        <p>
          <a href="https://drewhoover.com/wnba-comparator/">WNBA Comparator</a> — the same comparator over every WNBA
          career since 1997, the league's first season.
        </p>
        <p>
          <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a> — the longest active and
          all-time win streaks and losing streaks in college football, under any definition, every FBS team since 1936.
        </p>
        <p>
          <a href="https://drewhoover.com/hostile-territory/">Hostile Territory</a> — every head coach's true road
          record against AP top-10 teams since 1936.
        </p>
        <p>
          <a href="https://drewhoover.com/how-many-rings/">How Many Rings?</a> — every person on a
          national-championship staff since 1990, ranked by the rings they can claim.
        </p>
      </div>

      <h2 className="notes-h">Using a comparison from here</h2>
      <div className="notes">
        <p>
          If a comparison from this page ends up in your article, broadcast, podcast or thread, please cite it: name
          the site and link to the board; the url encodes the comparison.
        </p>
        <p>
          The site is free and serves no ads. If you enjoyed using it, consider{' '}
          <a href={KOFI_URL} onClick={() => track('kofi', { from: 'notes' })}>buying me some server compute</a> or
          donating to The Internet Archive's <a href="https://archive.org/donate">Wayback Machine</a> (I am a monthly
          donor, FTR).
        </p>
      </div>

      <section className="notes" id="method" aria-label="Method">
        <h2>Method</h2>
        <p>
          Every row is a player's games in order, with the box-score line and the result, from the league's first season
          ({first}, the BAA) to today, rebuilt from the files of {String(ledger.builtAt).slice(0, 10)}. The sections below
          say where the games come from, what the words mean, why the old names sit where they do, and what we fixed and
          couldn't.
        </p>

        <details>
          <summary>Where the games come from</summary>
          <p>
            From {espn} on the games are the ESPN box scores that{' '}
            <a href="https://github.com/sportsdataverse/hoopR-nba-data">hoopR</a> (sportsdataverse) publishes, CC BY 4.0,
            with the NBA Stats box scores hoopR also publishes (1996-97 on) filling the games and rows ESPN lacks. Before{' '}
            {espn} they are NBA.com's own game logs (stats.nba.com, read once with the open-source nba_api client and kept
            in this repo), cross-checked and patched against Eoin A. Moore's{' '}
            <a href="https://www.kaggle.com/datasets/eoinamoore/historical-nba-data-and-player-box-scores">NBA Dataset:
            Box Scores and Stats (1947 - Today)</a> on Kaggle, CC0, which is compiled from the same NBA.com data and keeps
            a few hundred rows NBA.com has since misplaced. A player who played on both sides of {espn} is one career,
            joined through hoopR's player crosswalk and, before it, by the same box line on the same day.
          </p>
          <p>
            A <b>position</b> is the one the NBA's own rosters list, one vote a season, else the NBA's position flags, else
            ESPN's; combo positions fold to the first letter, so a G-F is a guard. "Players" is everyone. Birth dates are
            ESPN's, else the NBA's. Where ESPN and NBA Stats disagree on a line, the league's book stands.
          </p>
        </details>

        <details>
          <summary>What the box score records, and since when</summary>
          <p>
            The box score filled in over the decades, and a stat here counts from the season it is in every game: points,
            field goals and free throws from {first}; fouls from 1951-52; field-goal attempts and rebounds from 1969-70;
            assists from 1975-76; threes from 1979-80 (when the line came in); minutes, offensive and defensive rebounds,
            steals, blocks and turnovers from 1983-84 (tracked from 1973-74 and 1977-78, with holes). A board says "since
            1983-84" when its stat forces it, a career from before that sits out, and so does any career with a game inside
            the window where the stat wasn't recorded; the board says how many of each.
          </p>
          <p>
            A triple-double counts the tracked stats, as the record books do, so Oscar Robertson's are points, rebounds
            and assists; his career began before assists were in every box, so he sits out the triple-double fields while
            Magic Johnson's 139 (the NBA says 138; the 139th is a 12-rebound line on Jan 12, 1988 that Basketball-Reference
            has as 8) stand. A <b>start</b> is ESPN's starter flag, so the starts fields begin in {espn}; where ESPN
            flagged more or fewer than five starters for a team (Miami and Indiana in 2004-07, mostly), NBA Stats' box
            score names them, and the three team-games nobody can name the starters of sit a career out of the starts
            fields when one falls inside its window.
          </p>
        </details>

        <details>
          <summary>What the words mean</summary>
          <p>
            A career here is an NBA career: a player who came over from the ABA (Julius Erving, George Gervin, David
            Thompson, Moses Malone) has his first NBA games as his first games, the way the NBA's own books read him. A{' '}
            <b>game</b> is one the player appeared in: a box-score row with minutes or points. A player who dressed and
            didn't play has no game, which is the league's games-played count. A <b>win</b> is the result of a game in the
            sequence. "Team games of a season" count the team's schedule, so a player who sat one has a gap the window
            still counts, and a player traded mid-season is read on his first team's schedule; a season that is over fills
            a longer window whole, so a 75-game 1959-60 ranks on an 82-game board as "all 75 games". The regular season is
            the default; the word beside it switches the playoffs in. Play-in games count as neither, as in the league's
            own books; the NBA Cup final is out too, and the Cup's group and knockout games count like any regular-season
            game; the All-Star game is out.
          </p>
          <p>
            A clean line ("no turnovers", "no fouls") counts only in a game the player was on the floor for ten minutes or
            more, so a two-minute cameo can't build a streak of them; every other test reads the box score as it is. Ranks
            are competition ranks, ties included. "Still inside the window" lists the players who haven't played the whole
            window yet, with their total so far. The panel reads a row against a peer: where their curves met, and what the
            player needs over the next five games to match the peer there; the peer rides in the url, so a shared link
            opens the same comparison. A player's page lists every comparison he leads, worded at the point in the career
            where it stands out most; "what he leads" in the panel goes there.
          </p>
        </details>

        <details>
          <summary>Why the old names sit where they do, and the eras</summary>
          <p>
            A career window favors the game as it was played in the 1960s: stars went 42 to 48 minutes a night (Wilt
            Chamberlain averaged 47.7 over his first 236 games, Luka Dončić 34.5 over his first 358), teams scored 110
            points a game from the shot clock through the 1980s against 96 in the late 1990s, eight or nine teams held all
            the talent, and a rookie arrived at 23 with four years of college behind him where LeBron arrived at 18. So
            "fastest to 10,000 points" reads Wilt, Jordan, Baylor, Kareem and Oscar before anyone born after 1960, and the
            modern names on these boards are the ones who were great from game one. The birth year is in the panel.
          </p>
          <p>
            The era word in the sentence is how to ask the fair question. Its cuts are the league's own: 1954-55, the
            24-second shot clock (team scoring went from 79 a game to 110); 1976-77, the ABA merger; 1979-80, the
            three-point line, and Bird and Magic; 1984-85, Jordan's first season and the first with a full box score in
            every game; 2001-02, zone defense allowed; 2004-05, the hand-check ban; 2014-15, the three-point era, with
            scoring back at 110. A stat's own wall (steals from 1983-84, threes from 1979-80) is the first choice when it is
            later than the ledger's start.
          </p>
        </details>

        <details>
          <summary>What we corrected, and what we couldn't</summary>
          <p>
            We checked famous numbers across every era against Basketball-Reference's game logs: career games and points
            match exactly for every career from {espn} on and for Jordan, Kareem, Russell, Pettit, Barry, Walton and
            Erving; Wilt's 100, his 126 straight 20-point games and 65 straight 30s, Kareem's 787 and Jordan's 866 games in
            double figures, Stockton's 1,164 assists and Eaton's 456 blocks all reproduce. Minutes after {espn} run a few
            minutes off over a career because ESPN rounds them. NBA.com's own book differs from Basketball-Reference by a
            point or two for a few careers of the 1950s and 1960s (Wilt reads 31,417 here, 31,419 there; Jerry West 25,200
            to 25,192), and we keep the league's. A published number can differ from one here by a game: NBA.com has
            Victor Wembanyama at 2,278 points through 100 games and both box scores say 2,273.
          </p>
          <p>
            What NBA.com's logs get wrong, we correct in the open (the rules are in the repo): the 1950s playoff
            tiebreakers it types as regular season (Pettit's 792 games and 20,880 points come out right once they move);
            another man's lines filed under a player's id in the middle of his season (25 of Ed Mikan's 1950-51 games were
            under George's); a line carried twice in a team-game under two ids, where the team's score says so; a stat
            written as 0 for every player of a game nobody recorded it for; and, after {espn}, four games ESPN dated to
            the next day and did-not-play rows it wrote as lines of zeros. What we can't fix we say: a few hundred
            team-games from 1969-70 to 1981-82 have no box beyond points, so Moses Malone sits out the career rebound
            fields for one game in 1976 and Kareem sits out career fouls for 24 games; NBA.com's player points miss the
            team score in about one team-game in a hundred before {espn}, and that book is the one we have.
          </p>
        </details>

        <p>
          A sibling of <a href="https://drewhoover.com/nfl-comparator/">NFL Comparator</a>,{' '}
          <a href="https://drewhoover.com/wnba-comparator/">WNBA Comparator</a> and{' '}
          <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a>.
        </p>
      </section>
    </>
  )
}
