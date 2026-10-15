package com.gamehub.search;

import com.gamehub.game.GameService;
import com.gamehub.search.repository.GameSearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Component
public class SearchIndexBootstrap {
    private static final Logger log = LoggerFactory.getLogger(SearchIndexBootstrap.class);

    private final GameService games;
    private final SearchIndexConsumer consumer;
    private final GameSearchRepository search;

    public SearchIndexBootstrap(GameService games, SearchIndexConsumer consumer, GameSearchRepository search) {
        this.games = games;
        this.consumer = consumer;
        this.search = search;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void indexOnStartup() {
        reconcile();
    }

    @Scheduled(fixedDelayString = "${gamehub.search.reconcile-ms:600000}", initialDelayString = "${gamehub.search.reconcile-initial-ms:600000}")
    public void reconcile() {
        try {
            Set<Long> publishedIds = new HashSet<>();
            for (var game : games.publishedAll()) {
                publishedIds.add(game.getId());
                try {
                    consumer.consume(new GameIndexEvent("RECONCILE", game.getId()));
                } catch (RuntimeException e) {
                    log.warn("Failed to reconcile search document for gameId={}", game.getId(), e);
                }
            }

            // Repair stale documents left behind if a delete/offline event could not be published.
            try {
                search.findAll().forEach(document -> {
                    if (document.getId() != null && !publishedIds.contains(document.getId())) {
                        search.deleteById(document.getId());
                    }
                });
            } catch (RuntimeException e) {
                log.warn("Failed to remove stale Elasticsearch documents during reconciliation", e);
            }
        } catch (RuntimeException e) {
            // Elasticsearch is optional for availability: public search already has a MySQL fallback.
            log.warn("Search index reconciliation skipped because a dependency is unavailable", e);
        }
    }
}
