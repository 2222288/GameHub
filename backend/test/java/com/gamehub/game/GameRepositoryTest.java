package com.gamehub.game;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.spring.MybatisSqlSessionFactoryBean;
import com.gamehub.game.entity.Game;
import com.gamehub.game.repository.GameRepository;
import org.apache.ibatis.session.SqlSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import static org.junit.jupiter.api.Assertions.*;

class GameRepositoryTest {
    private SqlSession session;
    private GameRepository repo;
    @BeforeEach void setup() throws Exception {
        var dataSource = new DriverManagerDataSource("jdbc:h2:mem:catalog_" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        new ResourceDatabasePopulator(new ClassPathResource("catalog-schema.sql")).execute(dataSource);
        var configuration = new MybatisConfiguration();
        configuration.addMapper(GameRepository.class);
        var interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        var factory = new MybatisSqlSessionFactoryBean();
        factory.setDataSource(dataSource); factory.setConfiguration(configuration); factory.setPlugins(interceptor);
        session = factory.getObject().openSession(true); repo = session.getMapper(GameRepository.class);
    }
    @AfterEach void close() {if (session != null) session.close();}
    @Test void filtersAndPaginationRunInTheDatabase() {
        Page<Game> first = repo.searchPublished(new Page<>(1,1), null,null,null,null,null,"views");
        assertEquals(3,first.getTotal()); assertEquals(3,first.getPages());
        assertEquals(2L,first.getRecords().get(0).getId());
        Page<Game> second = repo.searchPublished(new Page<>(2,1), null,null,null,null,null,"views");
        assertEquals(1L,second.getRecords().get(0).getId());
    }
    @Test void combinesTagPlatformLanguageAndCategoryFilters() {
        var result = repo.searchPublished(new Page<>(1,20), "rpg",1L,"RPG","Windows","English","updated");
        assertEquals(1,result.getTotal()); assertEquals(1L,result.getRecords().get(0).getId());
    }
    @Test void treatsWildcardAndInjectionCharactersAsLiteralInputs() {
        var literal = repo.searchPublished(new Page<>(1,20), "_",null,null,null,null,"updated");
        assertEquals(1,literal.getTotal()); assertEquals(3L,literal.getRecords().get(0).getId());
        var injection = repo.searchPublished(new Page<>(1,20), "' OR 1=1 --",null,null,null,null,"updated");
        assertEquals(0,injection.getTotal());
        var invalidSort = repo.searchPublished(new Page<>(1,20), null,null,null,null,null,"views; DROP TABLE game;");
        assertEquals(List.of(3L,2L,1L), invalidSort.getRecords().stream().map(Game::getId).toList());
    }
    @Test void groupsOnlyPublishedUndeletedGamesByCategory() {
        var counts = repo.countPublishedByCategory().stream().collect(Collectors.toMap(x->x.categoryId(),x->x.gameCount()));
        assertEquals(2L,counts.get(1L)); assertEquals(1L,counts.get(2L));
    }
}
