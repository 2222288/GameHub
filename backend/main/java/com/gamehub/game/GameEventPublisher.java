package com.gamehub.game;

import com.gamehub.infrastructure.RabbitConfig;
import com.gamehub.search.GameIndexEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class GameEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(GameEventPublisher.class);

    private final RabbitTemplate rabbit;

    public GameEventPublisher(RabbitTemplate rabbit) {
        this.rabbit = rabbit;
    }

    public void publish(String type, Long id) {
        Runnable send = () -> sendSafely(type, id);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    private void sendSafely(String type, Long id) {
        try {
            rabbit.convertAndSend(
                    RabbitConfig.EXCHANGE,
                    "game." + type.toLowerCase(),
                    new GameIndexEvent("GAME_" + type.toUpperCase(), id));
        } catch (RuntimeException e) {
            // The MySQL transaction may already be committed here. Do not turn a successful write into a false 500.
            // SearchIndexBootstrap periodically reconciles Elasticsearch as a repair path.
            log.error("Failed to publish game index event type={}, gameId={}; scheduled reconciliation will retry", type, id, e);
        }
    }
}
